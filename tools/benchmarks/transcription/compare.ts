/** Agent-operated batch: snapshot active takes and run only missing conditions. No retries. */
const root = `http://127.0.0.1:${process.env.TRANSCRIPTION_LAB_PORT ?? 8771}`;
const html = await (await fetch(root)).text();
const token = html.match(/name="workbench-token" content="([^"]+)"/)?.[1];
if (!token) throw Error('Workbench unavailable');
const headers = { 'x-workbench-token': token, 'Content-Type': 'application/json' };
const state = await (await fetch(root + '/api/state', { headers })).json();
const selected = ['scribe-forced-clean', 'scribe-forced-verbatim', 'scribe-auto-clean', 'scribe-auto-verbatim', 'whisper-large-v3-forced', 'whisper-large-v3-auto'];
const takes = state.takes.filter((t: { removedAt?: string }) => !t.removedAt);
console.log(JSON.stringify({ takes: takes.length, conditions: selected, existingResults: state.results.length }));
for (const take of takes) {
  for (const conditionId of selected) {
    const condition = state.conditions.find((c: { id: string }) => c.id === conditionId);
    if (!state.providers[condition.provider] || state.results.some((r: { takeId: string; condition: {id: string} }) => r.takeId === take.id && r.condition.id === conditionId)) continue;
    const response = await fetch(root + '/api/run', { method: 'POST', headers, body: JSON.stringify({ takeId: take.id, conditionId }) });
    const result = await response.json();
    if (!response.ok) throw Error(`Workbench refused: ${result.error}`);
    console.log(JSON.stringify({ take: take.id, condition: conditionId, status: result.status, text: result.text, error: result.error }));
  }
}
