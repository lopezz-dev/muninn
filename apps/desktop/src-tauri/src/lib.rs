#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();
    // Va la primera: si ya hay una ventana abierta, el segundo arranque (p. ej. Windows abriendo
    // `muninn://auth/callback`) le pasa el enlace y se cierra (ADR-0059).
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    }
    builder
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            // Comprueba y aplica las versiones firmadas de GitHub Releases (ADR-0047). La web decide cuándo.
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            #[cfg(any(windows, target_os = "macos"))]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    mark_user_agent(&window, &app.package_info().version.to_string())?;
                }
            }
            // El instalador registra `muninn://`; en `tauri dev` no hay instalador y se registra al arrancar.
            #[cfg(all(debug_assertions, any(windows, target_os = "linux")))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.deep_link().register_all()?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error al arrancar Muninn");
}

/// Añade `Muninn/<versión>` al user agent del webview. Sin la marca, WebView2 manda el de Edge tal cual y la lista de
/// sesiones (ADR-0061) no distingue la app de un navegador. Vale para las sesiones que se abren después: las que ya
/// existen guardan el user agent del momento en que se entró.
#[cfg(windows)]
fn mark_user_agent(window: &tauri::WebviewWindow, version: &str) -> tauri::Result<()> {
    let mark = format!("Muninn/{version}");
    window.with_webview(move |webview| unsafe {
        use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings2;
        use windows::core::{Interface, HSTRING, PWSTR};
        let Ok(settings) = webview
            .controller()
            .CoreWebView2()
            .and_then(|core| core.Settings())
            .and_then(|s| s.cast::<ICoreWebView2Settings2>())
        else {
            return;
        };
        // El de WebView2 se conserva entero (`… Chrome/x Safari/537.36 Edg/x`): solo se añade la marca al final.
        let mut current = PWSTR::null();
        if settings.UserAgent(&mut current).is_err() {
            return;
        }
        let base = webview2_com::take_pwstr(current);
        if !base.contains("Muninn/") {
            let _ = settings.SetUserAgent(&HSTRING::from(format!("{base} {mark}")));
        }
    })
}

/// En macOS, WKWebView no deja leer su user agent, pero Apple lo congeló: es este (sin versión de Safari) más la marca.
#[cfg(target_os = "macos")]
fn mark_user_agent(window: &tauri::WebviewWindow, version: &str) -> tauri::Result<()> {
    let user_agent = format!(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Muninn/{version}"
    );
    window.with_webview(move |webview| unsafe {
        use objc2::{msg_send, runtime::AnyObject};
        use objc2_foundation::NSString;
        let wk = webview.inner() as *mut AnyObject;
        let ua = NSString::from_str(&user_agent);
        let _: () = msg_send![wk, setCustomUserAgent: &*ua];
    })
}
