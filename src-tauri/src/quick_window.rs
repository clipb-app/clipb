use tauri::{PhysicalPosition, WebviewWindow};

pub fn position_on_pointer_display(window: &WebviewWindow) -> tauri::Result<()> {
    let monitor = window
        .cursor_position()
        .ok()
        .and_then(|point| window.monitor_from_point(point.x, point.y).ok().flatten());

    if let Some(monitor) = monitor {
        let area = monitor.work_area();
        let scale = monitor.scale_factor();
        let position = centered_position(
            (area.position.x, area.position.y),
            (area.size.width, area.size.height),
            (
                (460.0 * scale).round() as u32,
                (560.0 * scale).round() as u32,
            ),
        );
        window.set_position(position)
    } else {
        window.center()
    }
}

fn centered_position(
    origin: (i32, i32),
    area: (u32, u32),
    size: (u32, u32),
) -> PhysicalPosition<i32> {
    PhysicalPosition::new(
        origin.0 + (area.0.saturating_sub(size.0) / 2) as i32,
        origin.1 + (area.1.saturating_sub(size.1) / 2) as i32,
    )
}

#[cfg(target_os = "macos")]
pub fn configure_overlay(window: &WebviewWindow) -> tauri::Result<()> {
    let window = window.clone();
    let dispatcher = window.clone();
    dispatcher.run_on_main_thread(move || {
        use objc2_app_kit::{
            NSMainMenuWindowLevel, NSWindow, NSWindowCollectionBehavior as Behavior,
        };

        let Ok(pointer) = window.ns_window() else {
            return;
        };
        // Tauri owns this NSWindow; AppKit calls must stay on the main thread.
        let native_window = unsafe { &*pointer.cast::<NSWindow>() };
        let mut behavior = native_window.collectionBehavior();
        behavior.remove(
            Behavior::MoveToActiveSpace
                | Behavior::FullScreenPrimary
                | Behavior::FullScreenNone
                | Behavior::Primary
                | Behavior::Auxiliary,
        );
        behavior.insert(
            Behavior::CanJoinAllSpaces
                | Behavior::FullScreenAuxiliary
                | Behavior::CanJoinAllApplications
                | Behavior::IgnoresCycle,
        );
        native_window.setCollectionBehavior(behavior);
        native_window.setLevel(NSMainMenuWindowLevel + 1);
        native_window.setHidesOnDeactivate(false);
    })
}

#[cfg(not(target_os = "macos"))]
pub fn configure_overlay(_window: &WebviewWindow) -> tauri::Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn centers_on_a_retina_display_left_of_the_primary_display() {
        assert_eq!(
            centered_position((-3024, 50), (3024, 1914), (920, 1120)),
            PhysicalPosition::new(-1972, 447)
        );
    }

    #[test]
    fn small_work_area_does_not_push_the_top_left_offscreen() {
        assert_eq!(
            centered_position((1920, -200), (400, 500), (460, 560)),
            PhysicalPosition::new(1920, -200)
        );
    }
}
