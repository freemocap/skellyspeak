//! Independent subscriptions to one pending execution. The executor owns settlement.
use crate::model::{AppError, ErrorCode, Result};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex, Weak},
};
use tokio::sync::watch;

struct Job<T: Clone> {
    id: String,
    result: watch::Sender<Option<Result<T>>>,
}
pub struct Registry<T: Clone>(Mutex<HashMap<String, Weak<Job<T>>>>);
impl<T: Clone> Default for Registry<T> {
    fn default() -> Self {
        Self(Mutex::new(HashMap::new()))
    }
}
pub struct Subscription<T: Clone> {
    job: Arc<Job<T>>,
    receiver: watch::Receiver<Option<Result<T>>>,
}
pub struct Producer<T: Clone> {
    job: Arc<Job<T>>,
}

impl<T: Clone> Registry<T> {
    pub fn subscribe(&self, key: String) -> Result<(Subscription<T>, Option<Producer<T>>)> {
        let mut jobs = self.0.lock().map_err(|_| {
            AppError::new(
                ErrorCode::Internal,
                "Pending execution registry is unavailable.",
            )
        })?;
        jobs.retain(|_, job| job.strong_count() > 0);
        if let Some(job) = jobs.get(&key).and_then(Weak::upgrade) {
            return Ok((
                Subscription {
                    receiver: job.result.subscribe(),
                    job,
                },
                None,
            ));
        }
        let (result, receiver) = watch::channel(None);
        let job = Arc::new(Job {
            id: uuid::Uuid::new_v4().to_string(),
            result,
        });
        jobs.insert(key, Arc::downgrade(&job));
        Ok((
            Subscription {
                job: job.clone(),
                receiver,
            },
            Some(Producer { job }),
        ))
    }
}
impl<T: Clone> Subscription<T> {
    pub fn id(&self) -> &str {
        &self.job.id
    }
    pub async fn wait(mut self) -> Result<T> {
        loop {
            if let Some(result) = self.receiver.borrow_and_update().clone() {
                return result;
            }
            self.receiver.changed().await.map_err(|_| interrupted())?;
        }
    }
}
fn interrupted() -> AppError {
    AppError::new(
        ErrorCode::UnknownOutcome,
        "Execution interrupted before settlement. No automatic retry was made.",
    )
}
impl<T: Clone> Producer<T> {
    pub fn id(&self) -> &str {
        &self.job.id
    }
    pub fn has_subscribers(&self) -> bool {
        self.job.result.receiver_count() > 0
    }
    pub fn finish(self, result: Result<T>) {
        self.job.result.send_replace(Some(result));
    }
}
impl<T: Clone> Drop for Producer<T> {
    fn drop(&mut self) {
        let unfinished = self.job.result.borrow().is_none();
        if unfinished {
            self.job.result.send_replace(Some(Err(interrupted())));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn leaving_one_consumer_preserves_others_and_finished_jobs_expire() {
        let registry = Registry::<usize>::default();
        let (first, producer) = registry.subscribe("same".into()).unwrap();
        let producer = producer.unwrap();
        let (second, duplicate) = registry.subscribe("same".into()).unwrap();
        assert!(duplicate.is_none());
        assert_eq!(first.id(), second.id());
        drop(first);
        assert!(producer.has_subscribers());
        producer.finish(Ok(7));
        assert_eq!(second.wait().await.unwrap(), 7);
        assert!(registry.subscribe("same".into()).unwrap().1.is_some());
    }
    #[tokio::test]
    async fn last_consumer_leaving_is_visible_before_dispatch_and_abandonment_is_explicit() {
        let registry = Registry::<usize>::default();
        let (subscriber, producer) = registry.subscribe("one".into()).unwrap();
        let producer = producer.unwrap();
        drop(subscriber);
        assert!(!producer.has_subscribers());
        let (subscriber, _) = registry.subscribe("one".into()).unwrap();
        drop(producer);
        assert_eq!(
            subscriber.wait().await.unwrap_err().code,
            ErrorCode::UnknownOutcome
        );
    }
}
