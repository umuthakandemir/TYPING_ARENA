"""Typing Arena için HTTP ve WebSocket sunucusu.

Bu modül tarayıcı dosyalarını sunar ve çok oyunculu odaları bellekte tutar.
"""

# Dosya yollarını işletim sisteminden bağımsız yönetmek için pathlib kullanılır.
from pathlib import Path

# Oda kodlarının tahmin edilmesini zorlaştırmak için güvenli rastgele değer üretilir.
import secrets

# Oda kodlarında kullanılacak büyük harf ve rakam kümesi.
import string

# Oyunun ortak başlama anını oyunculara bildirmek için zaman damgası gerekir.
import time

# FastAPI HTTP ve WebSocket uç noktalarını tanımlar.
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

# HTML, CSS ve JavaScript dosyalarını doğrudan diskten döndürür.
from fastapi.responses import FileResponse


# Bu Python dosyasının bulunduğu klasör, projenin ana klasörüdür.
BASE = Path(__file__).resolve().parent

# FastAPI uygulaması; launcher.py bu nesneyi Uvicorn ile çalıştırır.
app = FastAPI(title="Typing Arena")

# Oda verileri sunucu belleğinde tutulur; sunucu kapanınca odalar silinir.
rooms = {}


# Ana sayfa isteğinde oyunun HTML dosyasını gönder.
@app.get("/")
async def index():
    return FileResponse(BASE / "index.html")


# Stil dosyasını tarayıcıya CSS içerik türüyle gönder.
@app.get("/styles.css")
async def css():
    return FileResponse(BASE / "styles.css", media_type="text/css")


# Oyun mantığını tarayıcıya JavaScript olarak gönder.
@app.get("/app.js")
async def javascript():
    return FileResponse(BASE / "app.js", media_type="application/javascript")


# Altı karakterli, büyük harf ve rakamlardan oluşan oda kodu üret.
def make_code():
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(6))


# İstemcilere gönderilecek oyuncu listesini WebSocket nesneleri olmadan hazırla.
def players_view(room):
    player_list = []

    # Her oyuncunun sadece tarayıcıda gösterilmesi gereken alanlarını seç.
    for player in room["players"].values():
        player_list.append(
            {
                "id": player["id"],
                "name": player["name"],
                "admin": player["id"] == room["admin"],
                "score": player.get("score", 0),
                "done": player.get("done", 0),
                "avatar": player.get("avatar", 0),
            }
        )

    return player_list


# Bir odadaki bütün oyunculara aynı JSON mesajını ilet.
async def broadcast(room, message):
    disconnected_ids = []

    # Bağlantı koptuysa oyuncuyu daha sonra odadan temizlemek üzere işaretle.
    for player_id, player in list(room["players"].items()):
        try:
            await player["ws"].send_json(message)
        except Exception:
            disconnected_ids.append(player_id)

    # Gönderim yapılamayan bağlantıları odadan kaldır.
    for player_id in disconnected_ids:
        room["players"].pop(player_id, None)


# Lobi ekranındaki oyuncu listesini bütün odaya yeniden gönder.
async def broadcast_lobby(room):
    await broadcast(
        room,
        {
            "type": "lobby",
            "players": players_view(room),
        },
    )


# Her WebSocket bağlantısı için ayrı oyuncu kimliği ve oda takibi oluştur.
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # WebSocket el sıkışmasını kabul et.
    await websocket.accept()

    # Sunucu içinde benzersiz bir oyuncu kimliği üret.
    player_id = secrets.token_hex(4)

    # Bağlantının henüz bir odaya katılmadığını belirt.
    current_room_code = None

    try:
        # Bağlantı açık kaldığı sürece istemciden gelen mesajları işle.
        while True:
            message = await websocket.receive_json()
            message_type = message.get("type")

            # Yeni oda oluşturma isteği.
            if message_type == "create":
                room_code = make_code()

                # Aynı kod daha önce üretilmişse benzersiz olana kadar yenile.
                while room_code in rooms:
                    room_code = make_code()

                # Odanın yöneticisini ve oyuncu sözlüğünü oluştur.
                room = {
                    "admin": player_id,
                    "players": {},
                    "started": False,
                }
                rooms[room_code] = room
                current_room_code = room_code

                # Oda kurucusunun oyuncu kaydını ekle.
                room["players"][player_id] = {
                    "id": player_id,
                    "name": str(message.get("name") or "Oyuncu")[:18],
                    "ws": websocket,
                    "score": 0,
                    "done": 0,
                    "avatar": max(0, min(24, int(message.get("avatar", 0)))),
                }

                # Kurucuya oda kodunu ve oyuncu listesini bildir.
                await websocket.send_json(
                    {
                        "type": "joined",
                        "room": room_code,
                        "player_id": player_id,
                        "admin": True,
                        "players": players_view(room),
                    }
                )
                await broadcast_lobby(room)

            # Var olan bir odaya katılma isteği.
            elif message_type == "join":
                room_code = str(message.get("room", "")).upper()
                room = rooms.get(room_code)

                # Oda yoksa veya oyun başladıysa katılımı reddet.
                if not room or room["started"]:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": "Oda bulunamadı veya oyun başlamış.",
                        }
                    )
                    continue

                current_room_code = room_code

                # Yeni oyuncuyu avatarı ve başlangıç skoruyla odaya ekle.
                room["players"][player_id] = {
                    "id": player_id,
                    "name": str(message.get("name") or "Oyuncu")[:18],
                    "ws": websocket,
                    "score": 0,
                    "done": 0,
                    "avatar": max(0, min(24, int(message.get("avatar", 0)))),
                }

                # Katılan oyuncuya oda bilgisini bildir.
                await websocket.send_json(
                    {
                        "type": "joined",
                        "room": room_code,
                        "player_id": player_id,
                        "admin": False,
                        "players": players_view(room),
                    }
                )
                await broadcast_lobby(room)

            # Oyun başlatma isteği yalnızca oda yöneticisinden kabul edilir.
            elif message_type == "start":
                room = rooms.get(current_room_code)

                # Oda yoksa, gönderen yönetici değilse veya oyun başladıysa çık.
                if not room or room["admin"] != player_id or room["started"]:
                    continue

                # İstemciden gelen oyun ayarlarını ve kelimeleri al.
                config = message.get("config") or {}
                word_list = message.get("words") or []

                # Boş veya liste olmayan kelime verisini kabul etme.
                if not isinstance(word_list, list) or not word_list:
                    continue

                # Odayı başlatılmış olarak işaretle; yeni katılımları engelle.
                room["started"] = True

                # Bütün oyunculara aynı kelimeleri, temayı ve başlama anını ilet.
                await broadcast(
                    room,
                    {
                        "type": "started",
                        "start_at": time.time() + 3,
                        "config": config,
                        "words": word_list,
                        "theme": message.get("theme"),
                    },
                )

            # Oyuncunun skor ve tamamladığı kelime sayısı güncellemesi.
            elif message_type == "stats":
                room = rooms.get(current_room_code)

                # Yalnızca oyunda bulunan oyuncuların skorunu güncelle.
                if room and room["started"] and player_id in room["players"]:
                    room["players"][player_id].update(
                        score=int(message.get("score", 0)),
                        done=int(message.get("done", 0)),
                    )

                    # Güncel skor tablosunu bütün oyunculara yayınla.
                    await broadcast(
                        room,
                        {
                            "type": "stats",
                            "players": players_view(room),
                        },
                    )

    # Tarayıcı bağlantıyı normal biçimde kapattığında bu istisna oluşur.
    except WebSocketDisconnect:
        pass

    # Bağlantı hangi nedenle biterse bitsin oyuncuyu odadan temizle.
    finally:
        if current_room_code in rooms:
            room = rooms[current_room_code]
            room["players"].pop(player_id, None)

            # Odada oyuncu kalmadıysa odayı tamamen sil.
            if not room["players"]:
                rooms.pop(current_room_code, None)

            else:
                # Yönetici ayrıldıysa odadaki ilk oyuncuyu yeni yönetici yap.
                if room["admin"] == player_id:
                    room["admin"] = next(iter(room["players"]))

                # Kalan oyuncuların lobi listesini yenile.
                await broadcast_lobby(room)
