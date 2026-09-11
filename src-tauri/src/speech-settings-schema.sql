UPDATE conversation_settings SET settings=json_set(settings,'$.autoSend',json('true'),'$.readAloud',json('true'),'$.speechVoice','alloy'), revision=revision+1;
UPDATE metadata SET revision=revision+1;
PRAGMA user_version=8;
