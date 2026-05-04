use serde::Serialize;

/// Battery state exposed to the frontend.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatteryState {
    pub is_present: bool,
    pub level: f32,       // 0.0 – 1.0
    pub is_charging: bool,
}

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
