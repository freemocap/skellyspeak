//! Auth guidance identifies the rejected connection without exposing URLs or bodies.
use crate::model::ConnectionRoute;

pub fn message(route: ConnectionRoute, url: &str, operation: &str, status: u16) -> Option<String> {
    if !matches!(status, 401 | 403) {
        return None;
    }
    let guidance = match route {
        ConnectionRoute::Custom => {
            let local = reqwest::Url::parse(url).ok().is_some_and(|url| {
                url.host_str().is_some_and(|host| {
                    host == "localhost"
                        || host
                            .trim_matches(['[', ']'])
                            .parse::<std::net::IpAddr>()
                            .is_ok_and(|ip| ip.is_loopback())
                })
            });
            match (status, local) {
                (401, true) => {
                    "The local server rejected the app's session token. In Settings → AI access → Custom URL, replace the Server session token with the current contents of server/.local-server/session-token.txt, then check the connection. Local server tokens persist across restarts; resetting local credentials invalidates previous tokens. This is authentication to your server, not its internal provider API keys."
                }
                (401, false) => {
                    "The custom server rejected the app's session token. In Settings → AI access → Custom URL, enable server session token authentication and save a current token issued by that server, then check the connection. This is authentication to your server, not its internal provider API keys."
                }
                _ => {
                    "The custom server denied access to this request. Check the server session token and its permissions in Settings → AI access → Custom URL. This is access to your server, not its internal provider API keys."
                }
            }
        }
        ConnectionRoute::Hosted => {
            "The SkellySpeak service rejected your session or account access. Sign in again in Settings → AI access → Hosted sign-in and check account access."
        }
        ConnectionRoute::Openrouter
            if operation == "Transcription" || operation == "Connection check" =>
        {
            "Groq rejected the app's API credential or its permissions. Check the Groq API key in Settings → AI access → API keys."
        }
        ConnectionRoute::Openrouter => {
            "OpenRouter rejected the app's API credential or its permissions. Check the OpenRouter API key in Settings → AI access → API keys."
        }
    };
    Some(format!(
        "{operation}: HTTP {status}. {guidance} No automatic retry was made."
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn distinguishes_server_session_from_provider_credentials() {
        let local = message(
            ConnectionRoute::Custom,
            "http://127.0.0.1:8765/v1",
            "Transcription",
            401,
        )
        .unwrap();
        assert!(local.contains("persist across restarts"));
        assert!(local.contains("session-token.txt"));
        let remote = message(
            ConnectionRoute::Custom,
            "https://private.example/v1",
            "Transcription",
            401,
        )
        .unwrap();
        assert!(remote.contains("token issued by that server"));
        assert!(!remote.contains("private.example"));
        assert!(!remote.contains("session-token.txt"));
        assert!(
            message(ConnectionRoute::Openrouter, "", "Transcription", 401)
                .unwrap()
                .contains("Groq API key")
        );
        assert!(
            message(ConnectionRoute::Openrouter, "", "Speech", 403)
                .unwrap()
                .contains("OpenRouter API key")
        );
        assert!(
            message(ConnectionRoute::Custom, "", "Chat", 403)
                .unwrap()
                .contains("denied access")
        );
        assert!(message(ConnectionRoute::Custom, "", "Chat", 502).is_none());
    }
}
