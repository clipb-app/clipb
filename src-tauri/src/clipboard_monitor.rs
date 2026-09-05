use std::{
    sync::mpsc::{self, Receiver, RecvTimeoutError, Sender},
    time::Duration,
};
use tauri::{Emitter, EventTarget};

pub const CLIPBOARD_CHECK_EVENT: &str = "clipb://clipboard-check";

pub struct ClipboardMonitor(Sender<()>);

impl ClipboardMonitor {
    pub fn start(app: tauri::AppHandle) -> std::io::Result<Self> {
        let (stop, receiver) = mpsc::channel();
        std::thread::Builder::new()
            .name("clipb-clipboard-monitor".into())
            .spawn(move || {
                poll_until_stopped(receiver, Duration::from_millis(750), || {
                    // Native events continue waking the capture webview when it is hidden.
                    if let Err(error) = app.emit_to(
                        EventTarget::webview_window("main"),
                        CLIPBOARD_CHECK_EVENT,
                        (),
                    ) {
                        eprintln!("Could not request clipboard capture: {error}");
                    }
                });
            })?;
        Ok(Self(stop))
    }

    pub fn stop(&self) {
        let _ = self.0.send(());
    }
}

fn poll_until_stopped(receiver: Receiver<()>, interval: Duration, mut poll: impl FnMut()) {
    while let Err(RecvTimeoutError::Timeout) = receiver.recv_timeout(interval) {
        poll();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn polling_repeats_without_a_window_and_stops_on_request() {
        let (stop, receiver) = mpsc::channel();
        let (ticks, observed) = mpsc::channel();
        let worker = std::thread::spawn(move || {
            poll_until_stopped(receiver, Duration::from_millis(1), || {
                ticks.send(()).unwrap();
            });
        });
        for _ in 0..3 {
            observed.recv_timeout(Duration::from_secs(2)).unwrap();
        }
        stop.send(()).unwrap();
        worker.join().unwrap();
    }

    #[test]
    fn polling_stops_when_sender_is_dropped() {
        let (stop, receiver) = mpsc::channel();
        drop(stop);
        poll_until_stopped(receiver, Duration::ZERO, || panic!("poll after shutdown"));
    }
}
