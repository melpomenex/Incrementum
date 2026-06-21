use serde::Serialize;

/// Battery state exposed to the frontend.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatteryState {
    pub is_present: bool,
    pub level: f32,       // 0.0 – 1.0
    pub is_charging: bool,
}

// Desktop implementation: the `battery` crate has no Android/iOS backend
// (it fails to compile there with "Support for this target OS is not
// implemented yet!"), so it is a desktop-only dependency. On mobile we expose
// the same Tauri command but return a harmless default — the frontend already
// tolerates "no battery detected".
#[cfg(not(any(target_os = "android", target_os = "ios")))]
/// Tauri command: read current battery state via the `battery` crate.
///
/// Returns a default "plugged in" state if the battery crate fails or if
/// running on a platform where battery info is unavailable (e.g. desktop
/// without battery).
#[tauri::command]
pub fn get_battery_state() -> BatteryState {
    match battery::Manager::new().and_then(|mgr| mgr.batteries()) {
        Ok(mut bats) => {
            // Use the first battery if available
            match bats.next() {
                Some(Ok(bat)) => {
                    let state = bat.state();
                    let is_charging = matches!(
                        state,
                        battery::State::Charging | battery::State::Full
                    );
                    BatteryState {
                        is_present: true,
                        level: bat.state_of_charge().value,
                        is_charging,
                    }
                }
                _ => BatteryState {
                    is_present: false,
                    level: 1.0,
                    is_charging: true,
                },
            }
        }
        Err(_) => BatteryState {
            is_present: false,
            level: 1.0,
            is_charging: true, // Assume plugged-in when we can't detect
        },
    }
}

// Mobile stub: the `battery` crate is unavailable on android/ios (see the
// target-specific dependency in Cargo.toml). Mobile apps query battery via the
// OS directly if needed; the frontend treats `is_present: false` as "plugged
// in / unknown", which is the same fallback the desktop path uses on error.
#[cfg(any(target_os = "android", target_os = "ios"))]
#[tauri::command]
pub fn get_battery_state() -> BatteryState {
    BatteryState {
        is_present: false,
        level: 1.0,
        is_charging: true,
    }
}
