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

/// Deja el nombre del equipo en algo seguro dentro de un user agent: letras, números, espacios y `-_.'`, sin el
/// `.local` de macOS y con 40 caracteres como mucho. Vacío → `None`. En Linux no hay marca (y clippy lo daría por muerto).
#[cfg(any(windows, target_os = "macos", test))]
fn clean_device_name(raw: &str) -> Option<String> {
    let raw = raw.trim().trim_end_matches(".local");
    let name: String = raw
        .chars()
        .filter(|c| c.is_alphanumeric() || matches!(c, ' ' | '-' | '_' | '.' | '\''))
        .take(40)
        .collect();
    let name = name.trim().to_string();
    (!name.is_empty()).then_some(name)
}

/// El nombre del equipo (ADR-0081): en Windows, `COMPUTERNAME`; en macOS, el «Nombre del ordenador» de Ajustes
/// (`scutil --get ComputerName`). Así «Sesiones y dispositivos» dice «PC-ALEX · Muninn para Windows».
#[cfg(any(windows, target_os = "macos"))]
fn device_name() -> Option<String> {
    #[cfg(windows)]
    let raw = std::env::var("COMPUTERNAME").ok()?;
    #[cfg(target_os = "macos")]
    let raw = {
        let out = std::process::Command::new("/usr/sbin/scutil")
            .args(["--get", "ComputerName"])
            .output()
            .ok()?;
        String::from_utf8(out.stdout).ok()?
    };
    clean_device_name(&raw)
}

/// La marca del user agent: `Muninn/<versión>` y, si se sabe, el nombre del equipo entre paréntesis.
#[cfg(any(windows, target_os = "macos"))]
fn user_agent_mark(version: &str) -> String {
    match device_name() {
        Some(name) => format!("Muninn/{version} ({name})"),
        None => format!("Muninn/{version}"),
    }
}

/// Añade `Muninn/<versión> (<equipo>)` al user agent del webview. Sin la marca, WebView2 manda el de Edge tal cual y la
/// lista de sesiones (ADR-0061) no distingue la app de un navegador. Vale para las sesiones que se abren después: las que
/// ya existen guardan el user agent del momento en que se entró.
#[cfg(windows)]
fn mark_user_agent(window: &tauri::WebviewWindow, version: &str) -> tauri::Result<()> {
    let mark = user_agent_mark(version);
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
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) {}",
        user_agent_mark(version)
    );
    window.with_webview(move |webview| unsafe {
        use objc2::{msg_send, runtime::AnyObject};
        use objc2_foundation::NSString;
        let wk = webview.inner() as *mut AnyObject;
        let ua = NSString::from_str(&user_agent);
        let _: () = msg_send![wk, setCustomUserAgent: &*ua];
    })
}

#[cfg(test)]
mod tests {
    use super::clean_device_name;

    #[test]
    fn limpia_el_nombre_del_equipo() {
        assert_eq!(clean_device_name("PC-ALEX\r\n"), Some("PC-ALEX".into()));
        assert_eq!(clean_device_name("MacBook-de-Alex.local"), Some("MacBook-de-Alex".into()));
        assert_eq!(clean_device_name("Mac de Álex (2)"), Some("Mac de Álex 2".into()));
        assert_eq!(clean_device_name("   "), None);
        assert_eq!(clean_device_name(&"a".repeat(80)).map(|n| n.len()), Some(40));
    }
}
