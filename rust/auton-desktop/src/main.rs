mod app;
mod bridge;

fn main() {
    if let Err(error) = app::run() {
        eprintln!("Auton failed to start: {error:#}");
        std::process::exit(1);
    }
}
