"""Typing Arena sunucusunu başlatan, ağ adresini gösteren yardımcı dosya."""

# Dosya yollarını güvenli ve taşınabilir biçimde yönetmek için pathlib kullanılır.
from pathlib import Path

# Çalışma klasörünü, Python yorumlayıcısını ve ağ soketini yönetmek için modüller.
import os
import sys
import socket
import threading
import webbrowser

# Proje klasörünü bul ve göreli dosya yollarının doğru çalışması için oraya geç.
BASE = Path(__file__).resolve().parent
os.chdir(BASE)


def local_ip():
    """Bilgisayarın yerel ağ IPv4 adresini bulmayı dener."""

    # Dış ağa paket göndermeden işletim sisteminin kullanacağı arayüzü belirle.
    connection = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

    try:
        # Bu hedefe bağlanmak yalnızca çıkış arayüzünü seçmek için kullanılır.
        connection.connect(("8.8.8.8", 80))

        # Soketin seçtiği yerel IP adresini döndür.
        return connection.getsockname()[0]

    except OSError:
        # Ağ arayüzü belirlenemezse yalnızca bu bilgisayardan erişim adresi ver.
        return "127.0.0.1"

    finally:
        # İşimiz bitince ağ soketini mutlaka kapat.
        connection.close()


def main():
    """Gerekli paketi kontrol et, adresleri yazdır ve web sunucusunu çalıştır."""

    try:
        # Uvicorn, FastAPI uygulamasını HTTP ve WebSocket sunucusu olarak çalıştırır.
        import uvicorn

    except ImportError:
        # Uvicorn kurulu değilse proje bağımlılıklarını requirements.txt dosyasından kur.
        print("\nGerekli paketler kuruluyor...")
        import subprocess

        subprocess.check_call(
            [
                sys.executable,
                "-m",
                "pip",
                "install",
                "-r",
                str(BASE / "requirements.txt"),
            ]
        )

        # Kurulumdan sonra Uvicorn modülünü yeniden içe aktar.
        import uvicorn

    # Bu adres yalnızca sunucuyu çalıştıran bilgisayarın kendi tarayıcısı içindir.
    local_url = "http://127.0.0.1:8000"

    # Oyuncuların aynı Wi-Fi/LAN üzerinden bağlanacağı adresi hesapla.
    network_url = f"http://{local_ip()}:8000"

    # Kullanıcıya hem kendi bilgisayar adresini hem arkadaşları için adresi göster.
    print("\nTYPING ARENA başlatılıyor...")
    print("Bu bilgisayar: " + local_url)
    print("Aynı ağdaki oyuncular: " + network_url)
    print("Durdurmak için bu pencereye dönüp Ctrl+C yapın.\n")

    # Sunucu başladıktan kısa süre sonra ana sayfayı yerel tarayıcıda aç.
    threading.Timer(1.2, lambda: webbrowser.open(local_url)).start()

    # 0.0.0.0, aynı yerel ağa bağlı diğer cihazların da erişmesini sağlar.
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
    )


# Bu dosya doğrudan çalıştırıldığında sunucuyu başlat.
if __name__ == "__main__":
    try:
        main()

    # Ctrl+C ile durdurma isteğini temiz biçimde karşıla.
    except KeyboardInterrupt:
        print("\nSunucu kapatıldı.")

    # Başlatma hatasını göster ve pencerenin hemen kapanmasını önle.
    except Exception as error:
        print("\nBaşlatma hatası:", error)
        input("Kapatmak için Enter...")
