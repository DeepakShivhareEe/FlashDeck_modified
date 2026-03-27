import { requestJson } from '../lib/api'

export async function askDeckQuestion({ deckId, message }) {
  return requestJson('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deck_id: deckId, message }),
  }, 1, 45000)
}
