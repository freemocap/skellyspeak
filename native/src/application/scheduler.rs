use super::*;

pub(super) async fn scheduler(state: Arc<Application>, _app: tauri::AppHandle) {
    let client = match provider::client() {
        Ok(client) => client,
        Err(error) => {
            state.stop(error);
            return;
        }
    };
    loop {
        if let Err(error) = schedule_pending(&state, &client).await {
            state.stop(error);
            return;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}
pub(super) async fn schedule_pending(
    state: &Arc<Application>,
    client: &reqwest::Client,
) -> Result<()> {
    super::graph_execution::schedule(state, client).await
}
