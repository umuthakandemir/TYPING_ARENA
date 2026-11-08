# Typing Arena — mobil ve masaüstü sürümü

Typing Arena, Python/FastAPI sunucusu ve HTML/CSS/JavaScript arayüzüyle çalışan bir kelime-uzay savaşı oyunudur.

## Başlatma

1. Python 3.10 veya üstünü kurun.
2. Windows'ta `BAŞLAT.bat` dosyasına çift tıklayın. Alternatif olarak terminalde `python launcher.py` çalıştırın.
3. İlk açılışta eksik Python paketleri `requirements.txt` üzerinden kurulur.
4. Tarayıcıda `http://127.0.0.1:8000` açılır.
5. Aynı Wi-Fi/ağdaki arkadaşlar, başlatıcı penceresinde yazan `http://BILGISAYARIN-LAN-IP-ADRESI:8000` adresini açar. Windows Güvenlik Duvarı Python/Uvicorn bağlantısına izin vermelidir.

## Mobil kullanım

- Oyun başladığında ekranın altındaki **HEDEFİ YAZ** alanına dokunun. Bu alan telefonun kendi sanal klavyesini açar.
- Yazılan harfler yalnızca kilitli kelimeye gönderilir.
- Telefon klavyesindeki Backspace veya **SİL** düğmesi son girilen doğru harfi geri alır.
- Oyun alanına dokunmak yazı alanını yeniden odaklar.
- Mobil düzende yan listeler gizlenir; oyun alanı ekran genişliğini kullanır.
- Arayüz güvenli ekran boşluklarını (çentik/gesture alanı) ve küçük ekranları dikkate alır.

## Avatarlar

Oyuncu profilinden 25 özgün SVG çizgi-film avatarından biri seçilebilir. Avatar çizimleri proje içinde kodla üretilir; harici görsel veya telifli anime karakteri kullanılmaz. Seçilen avatar oda listesinde diğer oyunculara da gösterilir.

## Hedef imha efekti

Kelimenin son doğru harfi girildiğinde kutunun çerçevesi sekiz enerji parçasına ayrılır. Parçalar farklı yönlere savrulur ve kısa süre içinde kaybolur.

## Kod dosyaları ve sorumlulukları

| Dosya | Görevi |
|---|---|
| `index.html` | Oyun ekranı, menü, profil/avatar seçimi, mobil yazı alanı ve ayar kontrolleri |
| `styles.css` | Uzay görünümü, masaüstü/mobil yerleşimi, dokunmatik kontroller ve patlama animasyonu |
| `app.js` | Oyun döngüsü, kelime üretimi, lazer, klavye girişi, ses, tema, avatar ve WebSocket istemcisi |
| `server.py` | FastAPI HTTP uçları, oda yönetimi, oyuncu avatarları ve WebSocket mesajları |
| `launcher.py` | Sunucuyu başlatır, yerel ağ adresini gösterir ve tarayıcıyı açar |
| `requirements.txt` | Python bağımlılıklarını listeler |
| `BAŞLAT.bat` | Windows için başlatma kısayolu |

## Kod okunabilirliği

Kaynak dosyalar işlevlerine göre bölümlere ayrıldı ve ana fonksiyonların önüne Türkçe açıklama yorumları eklendi. JavaScript içinde oyun döngüsü, giriş işleme, avatar çizimi, lazer ve sunucu mesajları ayrı fonksiyonlarda tutulur. Python sunucu ve başlatıcı dosyalarında işlem adımları açıklayıcı yorumlarla satır satır anlatılır.

## Sınırlar ve notlar

- Çok oyunculu odalar sunucu belleğinde tutulur; sunucu kapanınca oda ve oyun oturumu sona erer.
- Aynı yerel ağ dışındaki oyuncular için sunucuyu internete açık bir makinede barındırmak veya güvenli bir VPN/tünel kullanmak gerekir.
- Bu sürümde Python derleme, JavaScript sözdizimi ve HTTP uç noktası kontrolleri yapılmıştır. Gerçek telefonlarda farklı tarayıcı/klavye kombinasyonları ve çok oyunculu uçtan uca senaryo ayrıca denenmelidir.
