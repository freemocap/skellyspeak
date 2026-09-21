"""Authenticated event-driven admin WebSocket. No HTTP refresh loop."""
import asyncio
from anyio import CancelScope
from datetime import datetime, timezone
from types import SimpleNamespace
from fastapi import HTTPException, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, ConfigDict, Field
from server.app.identity import admin_auth
from server.app.diagnostics import admin_events, admin_reports
from server.app.diagnostics.exceptions import describe
from server.app.admission.admission import Ingress


class Subscription(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    days: int = Field(default=30, ge=1, le=90)
    after: str = Field(default='', max_length=128, pattern=r'^[^/]*$')
    span: str = '1d'
    interval: str = '1h'
    hours: int = Field(default=24, ge=1, le=168)
    errors: bool = False
    request_id: str = Field(default='', pattern=r'^(?:[a-f0-9]{32})?$')


def authenticate(socket, cfg, db):
    local = getattr(socket.app.state, 'development_admin', None)
    origin = 'http://127.0.0.1:8765' if local else cfg.public_base_url.rstrip('/')
    if socket.headers.get('origin') != origin:
        raise HTTPException(403, 'Live administration requires the same-origin panel.')
    request = SimpleNamespace(headers=socket.headers, cookies=socket.cookies, client=socket.client, method='GET')
    return local.require(request) if local else admin_auth.require(request, cfg, db)


def snapshot(db, cfg, actor, local, selection):
    overview = admin_reports.overview(db, cfg, days=selection.days, after=selection.after)
    overview.update(environment='Local development · data clears on restart' if local else 'Hosted service', administrator=actor)
    return {'type': 'snapshot', 'selection': selection.model_dump(), 'overview': overview,
            'timeline': admin_reports.timeline(db, span=selection.span, interval=selection.interval),
            'logs': {'entries': admin_events.records(selection.hours, selection.errors, selection.request_id),
                     'since': datetime.now(timezone.utc).isoformat(),
                     'scope': 'Live events from this server instance; newest 500 retained. Use Load logs for historical or cross-instance records.'}}


def register(router, database, configuration):
    admin_events.install()
    connections = set()
    handshakes = Ingress(30)

    @router.websocket('/admin/live')
    async def live(socket: WebSocket):
        watchers, pending = [], []
        unsubscribe = None
        try:
            handshakes.take()
            actor = await asyncio.to_thread(authenticate, socket, configuration(), database())
            if len(connections) >= 4:
                await socket.close(code=1013)
                return
            connections.add(socket)
            await socket.accept()
            event, unsubscribe = admin_events.subscribe()
            local = getattr(socket.app.state, 'development_admin', None)
            # Firestore listeners include commits from other Cloud Run instances.
            # Local commits publish directly through transactions.run.
            if not local and hasattr(database().collection('global_usage'), 'on_snapshot'):
                for collection, limit in [('global_usage', 100), ('admission', 100), ('service_controls', 10), ('users', 10001)]:
                    watch = await asyncio.to_thread(database().collection(collection).limit(limit).on_snapshot,
                                                    lambda *_: admin_events.notify())
                    watchers.append(watch)
            controls = Ingress(30)
            selection = None
            receive = asyncio.create_task(socket.receive_text())
            changed = asyncio.create_task(event.wait())
            pending = [receive, changed]
            while True:
                ready, _ = await asyncio.wait(pending, timeout=30, return_when=asyncio.FIRST_COMPLETED)
                actor = await asyncio.to_thread(authenticate, socket, configuration(), database())
                if not ready:
                    await asyncio.wait_for(socket.send_json({'type': 'heartbeat'}), timeout=10)
                    continue
                if receive in ready:
                    raw = receive.result()
                    controls.take()
                    if len(raw) > 2048:
                        raise HTTPException(422, 'Live subscription exceeds 2 KiB.')
                    selection = Subscription.model_validate_json(raw)
                    if selection.span not in admin_reports.RANGES or selection.interval not in admin_reports.INTERVALS:
                        raise HTTPException(422, 'Invalid live chart selection.')
                    receive = asyncio.create_task(socket.receive_text())
                    pending = [receive, changed]
                if selection is not None:
                    # Coalesce bursts, retain one current snapshot, and bound slow clients.
                    await asyncio.sleep(.25)
                    event.clear()
                    result = await asyncio.to_thread(snapshot, database(), configuration(), actor, local, selection)
                    await asyncio.wait_for(socket.send_json(jsonable_encoder(result)), timeout=10)
                else:
                    event.clear()
                changed.cancel()
                await asyncio.gather(changed, return_exceptions=True)
                changed = asyncio.create_task(event.wait())
                pending = [receive, changed]
        except (WebSocketDisconnect, asyncio.CancelledError):
            pass
        except (HTTPException, ValueError) as error:
            if socket in connections:
                await socket.send_json({'type': 'error', 'detail': error.detail if isinstance(error, HTTPException) else 'Invalid live subscription.', 'diagnostics': describe(error)})
            await socket.close(code=1008)
        except Exception as error:
            if socket in connections:
                await socket.send_json({'type': 'error', 'detail': 'Live stream failed.',
                                        'diagnostics': describe(error)})
            await socket.close(code=1011, reason='Live stream failed; reconnect explicitly.')
        finally:
            if unsubscribe:
                unsubscribe()
            connections.discard(socket)
            with CancelScope(shield=True):
                for task in pending:
                    task.cancel()
                if pending:
                    await asyncio.gather(*pending, return_exceptions=True)
                for watcher in watchers:
                    await asyncio.to_thread(watcher.unsubscribe)
