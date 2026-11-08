'use strict';
// Tek bir CSS seçicisiyle sayfadaki elemanı bulmayı sağlayan kısa yardımcı.
const $=s=>document.querySelector(s);
// 25 seviye; hız ve eşzamanlı hedef sayısı kademeli artar.
const LEVELS=Array.from({
    length:25
},(_,i)=>{
    const n=i+1;
    return {
        speed:25+Math.min(58,i*2.25),max:Math.min(6,2+Math.floor(i/5)),count:15+Math.floor(i*1.8),label:n+' · '+(['Acemi','Temel','Çaylak','Pilot','Astro navigatör'][Math.min(4,Math.floor(i/5))])
    }
});
// Varsayılan oyun sözlüğü: uzay savaşı temasından bağımsız gündelik Türkçe kelimeler.
const WORDS=['pencere','kitap','zaman','şehir','düşünce','arkadaş','deniz','yolculuk','mektup','bahçe','müzik','kalem','orman','nehir','bulut','kahve','hikaye','gelecek','özgürlük','çalışma','başarı','merak','bilim','sanat','ışık','renk','sokak','rüzgar','güneş','gezegen','yıldız','roket','galaksi','uydu','yörünge'];
let selectedAvatar=0;
let mode='solo',state='menu',words=[],targets=[],done=0,score=0,combo=0,shield=100,spawnClock=0,last=0,level=1,settings={
    speed:35,max:3
},audio=null,ws=null,room=null,isAdmin=false,players={
},flashTimers=new Map(),laserTime=0,transientTheme=null,lastStats=0;
const canvas=$('#fx'),ctx=canvas.getContext('2d'),laser=$('#laser'),lctx=laser.getContext('2d');
let stars=[],matrixDrops=[];
for (let i = 1; i <= 25; i++) {
    const o=document.createElement('option');
    o.value=i;
    o.textContent=LEVELS[i-1].label;
    $('#level').append(o)
}
// Ekran ve lazer katmanlarının çözünürlüğünü cihaz piksel oranına göre ayarlar.
function resize(){
    const d=devicePixelRatio||1;
    canvas.width=innerWidth*d;
    canvas.height=innerHeight*d;
    canvas.style.width=innerWidth+'px';
    canvas.style.height=innerHeight+'px';
    ctx.setTransform(d,0,0,d,0,0);
    const ar=$('#arena'),w=ar.clientWidth,h=ar.clientHeight;
    laser.width=Math.max(1,w*d);
    laser.height=Math.max(1,h*d);
    laser.style.width=w+'px';
    laser.style.height=h+'px';
    lctx.setTransform(d,0,0,d,0,0);
    stars=Array.from({
        length:190
    },()=>({
        x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:Math.random()*1.8+.25,v:Math.random()*15+4,a:Math.random()*.8+.2
    }));
    matrixDrops=Array.from({
        length:Math.ceil(innerWidth/17)
    },()=>Math.random()*-innerHeight/17)
}
addEventListener('resize',resize);
resize();
// Arka planda yıldızları veya Matrix karakterlerini sürekli hareket ettirir.
function ambient(){
    ctx.clearRect(0,0,innerWidth,innerHeight);
    if($('#background').value==='matrix'){
        ctx.font='14px monospace';
        for(let i=0;
        i<matrixDrops.length;
        i++){
            let y=matrixDrops[i]*17;
            ctx.fillStyle='rgba(40,255,125,.10)';
            ctx.fillRect(i*17,y-100,2,100);
            ctx.fillStyle=`rgba(95,255,155,${.35+Math.random()*.55})`;
            ctx.fillText(['0','1','ア','カ','サ','タ','ナ','ハ','マ','ヤ','ラ'][Math.floor(Math.random()*11)],i*17,y);
            matrixDrops[i]+=0.48+((i%5)*.025);
            if(y>innerHeight&&Math.random()>.97)matrixDrops[i]=-Math.random()*35
        }
    }else{
        for(const s of stars){
            s.y+=s.v/60;
            if(s.y>innerHeight){
                s.y=0;
                s.x=Math.random()*innerWidth
            }ctx.globalAlpha=s.a*(.65+.35*Math.sin(performance.now()/700+s.x));
            ctx.fillStyle='#d9efff';
            ctx.fillRect(s.x,s.y,s.r,s.r)
        }
    }ctx.globalAlpha=1;
    requestAnimationFrame(ambient)
}requestAnimationFrame(ambient);
// Web Audio API ile seçili ses paketine uygun kısa efekt üretir.
function sound(type){
    if(!$('#sound').checked||$('#soundPack').value==='off')return;
    try{
        audio??=new(window.AudioContext||window.webkitAudioContext)();
        if(audio.state==='suspended')audio.resume();
        const pack=$('#soundPack').value;
        let f={
            hit:720,bad:145,miss:90,launch:410,key:520
        }[type]||500;
        if(pack==='laser')f*=type==='hit'?1.8:1.25;
        if(pack==='arcade')f*=type==='hit'?1.35:.8;
        if(pack==='soft')f*=.72;
        const o=audio.createOscillator(),g=audio.createGain();
        o.connect(g);
        g.connect(audio.destination);
        o.type=pack==='arcade'?'square':pack==='laser'?'sawtooth':'sine';
        o.frequency.value=f;
        g.gain.setValueAtTime(.045,audio.currentTime);
        g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.13);
        o.start();
        o.stop(audio.currentTime+.14)
    }catch(e){
    }
}
// Kullanıcının metnini Türkçe harfleri koruyarak kelimelere ayırır.
function parseWords(t){
    return t.toLocaleLowerCase('tr').split(/[^\p{L}\p{N}-]+/u).filter(Boolean)
}
// Menü penceresini açar ve oyun durumunu menü olarak işaretler.
function setMenu(msg=''){
    state='menu';
    document.body.dataset.game='menu';
    $('#menu').classList.remove('hidden');
    $('#message').textContent=msg
}
// Tek oyuncu, çok oyuncu ve özel kelime panelleri arasında geçiş yapar.
function selectTab(t){
    document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
    $('#soloPane').classList.toggle('hidden',t!=='solo');
    $('#customPane').classList.toggle('hidden',t!=='custom');
    $('#multiPane').classList.toggle('hidden',t!=='multi');
    mode=t
}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>selectTab(b.dataset.tab));
$('#mode').onchange=()=>{
    $('#level').disabled=$('#mode').value==='custom'
};
$('#multiMode').onchange=()=>$('#multiCustom').classList.toggle('hidden',$('#multiMode').value!=='custom');
const keyEls=new Map();
['qwertyuıopğü','asdfghjklşi','zxcvbnmöç',' '].forEach(row=>{
    const r=document.createElement('div');
    r.className='keyrow';
    [...row].forEach(ch=>{
        const k=document.createElement('div');
        k.className='key';
        k.textContent=ch===' '?'␣':ch;
        r.append(k);
        keyEls.set(ch,k)
    });
    $('#keyboard').append(r)
});
$('#showKeyboard').onchange=e=>$('#keyboard').classList.toggle('hidden',!e.target.checked);
// Ekran klavyesinde basılan tuşu doğru veya yanlış rengiyle kısa süre gösterir.
function flashKey(ch,ok){
    const el=keyEls.get(ch);
    if(!el)return;
    el.classList.remove('good','bad');
    void el.offsetWidth;
    el.classList.add(ok?'good':'bad');
    clearTimeout(flashTimers.get(ch));
    flashTimers.set(ch,setTimeout(()=>el.classList.remove('good','bad'),170))
}
// Tema ayarlarını form kontrollerinden tek bir nesne halinde toplar.
function baseTheme(){
    return {
        palette:$('#palette').value,background:$('#background').value,bgImage:document.body.dataset.customImage||'',box:$('#boxColor').value,border:$('#borderColor').value,word:$('#wordColor').value,font:+$('#fontSize').value,sharp:+$('#sharpness').value,accent:$('#accentColor').value
    }
}
// Tema renklerini, arka planı ve yazı görünümünü sayfaya uygular.
function applyTheme(t,persist=false){
    if(!t)return;
    const theme=t;
    document.body.dataset.palette=theme.palette||'neon';
    document.body.dataset.background=theme.background||'space';
    document.body.style.setProperty('--word-bg',theme.box||'#07182b');
    document.body.style.setProperty('--word-border',theme.border||'#36dfff');
    document.body.style.setProperty('--word-color',theme.word||'#f3fbff');
    document.body.style.setProperty('--word-size',(theme.font||20)+'px');
    document.body.style.setProperty('--word-sharp',String(theme.sharp??8)+'px');
    document.body.style.setProperty('--accent-custom',theme.accent||'#ff4fd8');
    document.body.dataset.customImage=theme.bgImage||'';
    if(theme.background==='image'&&theme.bgImage){
        $('#backdrop').style.backgroundImage=`linear-gradient(#02040d55,#02040d88),url("${theme.bgImage}")`;
        $('#backdrop').style.backgroundSize='cover';
        $('#backdrop').style.backgroundPosition='center'
    }else{
        $('#backdrop').style.backgroundImage='';
        $('#backdrop').style.backgroundSize=''
    }$('#palette').value=theme.palette||'neon';
    $('#background').value=theme.background||'space';
    $('#boxColor').value=theme.box||'#07182b';
    $('#borderColor').value=theme.border||'#36dfff';
    $('#wordColor').value=theme.word||'#f3fbff';
    $('#fontSize').value=theme.font||20;
    $('#sharpness').value=theme.sharp??8;
    $('#accentColor').value=theme.accent||'#ff4fd8';
    matrixDrops=Array.from({
        length:Math.ceil(innerWidth/17)
    },()=>Math.random()*-innerHeight/17);
    if(persist){
        try{
            localStorage.setItem('typingArenaLastTheme',JSON.stringify(theme))
        }catch(e){
        }
    }
}
// Mevcut görünüm ayarlarını kaydedilebilir/odaya gönderilebilir hale getir.
function readControls(){
    const t=baseTheme();
    applyTheme(t,true);
    return t
}
['palette','background','boxColor','borderColor','wordColor','fontSize','sharpness','accentColor'].forEach(id=>$('#'+id).addEventListener('input',()=>applyTheme(baseTheme())));
$('#bgImage').onchange=e=>{
    const f=e.target.files?.[0];
    if(!f)return;
    const reader=new FileReader();
    reader.onload=()=>{
        const im=new Image();
        im.onload=()=>{
            const c=document.createElement('canvas'),scale=Math.min(1,1600/im.width);
            c.width=Math.round(im.width*scale);
            c.height=Math.round(im.height*scale);
            c.getContext('2d').drawImage(im,0,0,c.width,c.height);
            document.body.dataset.customImage=c.toDataURL('image/jpeg',.78);
            $('#background').value='image';
            applyTheme(baseTheme())
        };
        im.src=reader.result
    };
    reader.readAsDataURL(f)
};
// Tarayıcının yerel depolamasındaki kayıtlı tema listesini yükle.
function themes(){
    let o={
    };
    try{
        o=JSON.parse(localStorage.getItem('typingArenaThemes')||'{}')
    }catch(e){
    };
    $('#savedThemes').innerHTML='<option value="">Kayıtlı temalar</option>'+Object.keys(o).map(n=>`<option>${escapeHtml(n)}</option>`).join('');
    return o
}
// Kullanıcı metnini HTML içine güvenli yerleştirmek için özel karakterleri kaçırır.
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[character]));
}
$('#saveTheme').onclick=()=>{const n=$('#themeName').value.trim();if(!n){$('#message').textContent='Önce temaya bir ad ver.';return}const o=themes();o[n]=baseTheme();try{localStorage.setItem('typingArenaThemes',JSON.stringify(o));themes();$('#savedThemes').value=n;$('#message').textContent=`“${n}” teması kaydedildi.`}catch(e){$('#message').textContent='Tema kaydedilemedi. Arka plan resmini küçültmeyi dene.'}};
$('#loadTheme').onclick=()=>{const t=themes()[$('#savedThemes').value];if(t)applyTheme(t,true)};$('#deleteTheme').onclick=()=>{const n=$('#savedThemes').value,o=themes();if(n&&o[n]){delete o[n];localStorage.setItem('typingArenaThemes',JSON.stringify(o));themes()}};themes();
try{const t=JSON.parse(localStorage.getItem('typingArenaLastTheme')||'null');if(t)applyTheme(t)}catch(e){}
// Yeni oyunu başlatır; kelimeleri, hedefleri, skoru ve oyun ayarlarını sıfırlar.
function startGame(list, config, gameMode, sharedTheme = null) {
    // Çok oyunculu oyunda oda yöneticisinin temasını geçici olarak uygula.
    if (sharedTheme) {
        transientTheme = sharedTheme;
        applyTheme(sharedTheme);
    } else {
        transientTheme = null;
    }

    // Oyun verilerini yeni oturum için sıfırla.
    mode = gameMode;
    words = [...list];
    targets = [];
    done = 0;
    score = 0;
    combo = 0;
    shield = 100;
    spawnClock = 0;
    settings = {
        speed: config.speed,
        max: Math.min(6, config.max)
    };

    // Menüden oyun ekranına geç ve mobil klavye alanını temizle.
    state = 'play';
    document.body.dataset.game = 'play';
    $('#menu').classList.add('hidden');
    $('#mobileInput').value = '';

    // Mobil tarayıcıda sanal klavyeyi kullanıcı başlatma dokunuşu sırasında aç.
    if (matchMedia('(max-width: 760px), (max-height: 560px) and (pointer: coarse)').matches) {
        $('#mobileInput').focus();
    }

    // Arayüz sayaçlarını sıfırla ve animasyon döngüsünü başlat.
    $('#resume').classList.add('hidden');
    $('#score').textContent = '0';
    $('#combo').textContent = '0';
    $('#shield').textContent = '100%';
    $('#writtenList').innerHTML = '';
    last = performance.now();
    lastStats = 0;
    updateHud();
    requestAnimationFrame(loop);
}

// Sıradaki kelimeyi oyun alanının üstünde rastgele yatay konumda oluşturur.
function spawn() {
    const wordIndex = done + targets.length;
    if (wordIndex >= words.length) return;

    // Kelime uzunluğuna göre kutu genişliğini tahmin et ve taşmayı önle.
    const word = words[wordIndex];
    const arena = $('#arena');
    const estimatedWidth = Math.min(
        420,
        word.length * (+$('#fontSize').value * 0.7) + 55
    );
    const maxX = Math.max(8, arena.clientWidth - estimatedWidth - 8);
    const x = 8 + Math.random() * maxX;

    // Yeni hedefi yazılmamış ve ekranın üstünde başlayacak şekilde kaydet.
    targets.push({
        word,
        x,
        y: -55,
        typed: '',
        wrongChar: '',
        wrongUntil: 0,
        id: Math.random()
    });
    sound('launch');
}

// Hedefi tamamlananlar listesine taşır; puan, kombo ve kalkanı günceller.
function finishTarget(wasSuccessful) {
    const target = targets.shift();
    if (!target) return;

    done++;
    const statusClass = wasSuccessful ? 'ok' : 'miss';
    const statusIcon = wasSuccessful ? '✓' : '✕';
    $('#writtenList').insertAdjacentHTML(
        'afterbegin',
        `<div class="item ${statusClass}">${statusIcon} ${escapeHtml(target.word)}</div>`
    );

    // Başarılı imha puan ve kombo kazandırır; kaçan hedef kalkana zarar verir.
    if (wasSuccessful) {
        score += target.word.length * 10 + combo * 5;
        combo++;
        sound('hit');
    } else {
        score -= 50;
        combo = 0;
        shield -= 20;
        sound('miss');
    }

    updateHud();

    // Kalkan sıfırlanırsa veya kelimeler biterse oyunu sonuç ekranına geçir.
    if (shield <= 0 || done >= words.length) {
        state = 'end';
        const result = shield <= 0
            ? `KALKAN ÇÖKTÜ · Skor ${score}`
            : `GÖREV TAMAM · Skor ${score}`;
        setMenu(result);
        $('#resume').classList.add('hidden');
    }
}

// Skor göstergelerini, ilerlemeyi ve sıradaki hedefler listesini yeniler.
function updateHud() {
    $('#score').textContent = score;
    $('#combo').textContent = combo;
    $('#shield').textContent = Math.max(0, shield) + '%';
    $('#progress').textContent = `${done}/${words.length}`;

    // Ekranda görünmeyen sıradaki kelimeleri sol panelde listeler.
    const upcomingWords = words.slice(
        done + targets.length,
        done + targets.length + 12
    );
    $('#queueList').innerHTML = upcomingWords
        .map(word => `<div class="item">${escapeHtml(word)}</div>`)
        .join('');
}

// Geminin ucundan kilitli kelimenin merkezine animasyonlu lazer çizer.
function drawLaser() {
    const pixelRatio = devicePixelRatio || 1;
    lctx.clearRect(0, 0, laser.width / pixelRatio, laser.height / pixelRatio);

    // Kilitli hedef yoksa lazer çizilmez.
    const target = $('#wordLayer .word.target');
    if (!target) return;

    // Gemi ve hedef koordinatlarını oyun alanına göre hesapla.
    const arenaRect = $('#arena').getBoundingClientRect();
    const shipRect = $('.ship').getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const startX = shipRect.left - arenaRect.left + shipRect.width / 2;
    const startY = shipRect.top - arenaRect.top + 3;
    const targetX = targetRect.left - arenaRect.left + targetRect.width / 2;
    const targetY = targetRect.top - arenaRect.top + targetRect.height / 2;

    // Işın parlaklığını ve hedef halkasını sinüs dalgasıyla titreştir.
    laserTime += 0.05;
    const pulse = 0.5 + 0.5 * Math.sin(laserTime * 5);
    lctx.save();
    lctx.lineCap = 'round';
    lctx.strokeStyle = '#29eaff';
    lctx.globalAlpha = 0.2 + pulse * 0.22;
    lctx.lineWidth = 10;
    lctx.shadowColor = '#29eaff';
    lctx.shadowBlur = 22;
    lctx.beginPath();
    lctx.moveTo(startX, startY);
    lctx.lineTo(targetX, targetY);
    lctx.stroke();

    // Kesikli iç ışın ve hedef merkezindeki kilit halkasını çiz.
    lctx.globalAlpha = 0.75;
    lctx.lineWidth = 2.2;
    lctx.setLineDash([9, 7]);
    lctx.lineDashOffset = -laserTime * 100;
    lctx.beginPath();
    lctx.moveTo(startX, startY);
    lctx.lineTo(targetX, targetY);
    lctx.stroke();
    lctx.setLineDash([]);
    lctx.fillStyle = '#ff4fd8';
    lctx.shadowColor = '#ff4fd8';
    lctx.shadowBlur = 16;
    lctx.beginPath();
    lctx.arc(targetX, targetY, 4 + pulse * 2, 0, Math.PI * 2);
    lctx.fill();
    lctx.strokeStyle = '#ff4fd8';
    lctx.lineWidth = 1.5;
    lctx.beginPath();
    lctx.arc(targetX, targetY, 12 + pulse * 4, 0, Math.PI * 2);
    lctx.stroke();
    lctx.restore();
}

// Ekrandaki kelime kutularını ve doğru/yanlış harf renklerini HTML olarak çizer.
function renderWords() {
    const now = performance.now();

    // İlk hedef kilitli hedeftir; yazılmış ve yanlış harfler ayrı sınıf alır.
    $('#wordLayer').innerHTML = targets.map((target, index) => {
        const targetClass = index === 0 ? 'target' : '';
        const letters = [...target.word].map((character, letterIndex) => {
            const wrongLetter = letterIndex === target.typed.length
                && target.wrongChar
                && now < target.wrongUntil
                ? `<span class="wrong">${escapeHtml(target.wrongChar)}</span>`
                : '';
            const letterClass = letterIndex < target.typed.length ? 'typed' : '';
            return `${wrongLetter}<span class="${letterClass}">${escapeHtml(character)}</span>`;
        }).join('');

        return `<div class="word ${targetClass}" style="left:${target.x}px;top:${target.y}px">${letters}</div>`;
    }).join('');
}

// Oyun döngüsünde kelimeleri düşürür, yeni hedef üretir ve çarpışmayı kontrol eder.
function loop(now) {
    if (state !== 'play') return;

    // Kareler arası süreyi sınırla; sekme arka plandan dönünce ani sıçramayı önle.
    const deltaSeconds = Math.min(0.05, (now - last) / 1000);
    last = now;
    spawnClock += deltaSeconds;

    // Ekrandaki hedef sayısı ayar sınırının altındaysa yeni kelime oluştur.
    const canSpawn = targets.length < settings.max
        && done + targets.length < words.length;
    const spawnIntervalReached = targets.length === 0
        || spawnClock >= Math.max(0.65, 1.5 - settings.speed / 100);
    if (canSpawn && spawnIntervalReached) {
        spawn();
        spawnClock = 0;
    }

    // Bütün hedefleri aşağı hareket ettir; ilk hedef çizgiyi geçerse kaçırılmış say.
    targets.forEach(target => {
        target.y += settings.speed * deltaSeconds;
    });
    const bottomLimit = $('#arena').clientHeight - 52;
    if (targets[0] && targets[0].y >= bottomLimit) {
        finishTarget(false);
    }

    // Görüntüyü ve lazeri yenile; çok oyunculu oyunda skorları sunucuya yolla.
    renderWords();
    drawLaser();
    if (mode === 'multi' && now - lastStats > 450) {
        send({ type: 'stats', score, done });
        lastStats = now;
    }

    if (state === 'play') requestAnimationFrame(loop);
}

// Yalnızca kilitli hedefe harf kabul eder; doğru ve yanlış girişi işler.
function typeKey(key) {
    if (state !== 'play' || key.length !== 1) return;
    const target = targets[0];
    if (!target) return;

    const character = key.toLocaleLowerCase('tr');
    const expectedCharacter = target.word[target.typed.length];

    // Doğru harfte ilerle; kelimenin son harfinde patlama animasyonunu oynat.
    if (character === expectedCharacter) {
        target.typed += character;
        target.wrongChar = '';
        flashKey(character, true);
        sound('key');

        if (target.typed.length === target.word.length) {
            explodeTarget();
            finishTarget(true);
        } else {
            updateHud();
        }

    // Yanlış harfi kırmızı göster, puan düşür ve komboyu sıfırla.
    } else {
        target.wrongChar = character;
        target.wrongUntil = performance.now() + 450;
        flashKey(character, false);
        score -= 5;
        combo = 0;
        sound('bad');
        updateHud();
        renderWords();
    }
}

addEventListener('keydown',e=>{if(e.key==='Escape'){if(state==='play'){state='pause';document.body.dataset.game='pause';setMenu('Oyun duraklatıldı.');$('#resume').classList.remove('hidden')}else if(state==='pause')resume();return}if(state==='play'&&e.key==='Backspace'){if(e.target===$('#mobileInput'))return;e.preventDefault();eraseLastCharacter();return}if(e.target===$('#mobileInput'))return;if(!e.ctrlKey&&!e.metaKey&&!e.altKey)typeKey(e.key)});
// Duraklatılmış oyunu kaldığı yerden devam ettirir.
function resume() {
    state = 'play';
    document.body.dataset.game = 'play';
    $('#menu').classList.add('hidden');
    $('#mobileInput').value = '';

    // Devam düğmesine dokunulması mobil sanal klavyeyi açmak için kullanıcı hareketidir.
    if (matchMedia('(max-width: 760px), (max-height: 560px) and (pointer: coarse)').matches) {
        $('#mobileInput').focus();
    }

    $('#resume').classList.add('hidden');
    last = performance.now();
    requestAnimationFrame(loop);
}

// Devam düğmesi ve ayarlar düğmesinin tıklama davranışlarını bağla.
$('#resume').onclick = resume;
$('#settingsBtn').onclick = () => {
    if (state === 'play') {
        state = 'pause';
        $('#resume').classList.remove('hidden');
    }
    setMenu('Ayarları düzenle veya devam et.');
};

$('#startSolo').onclick=()=>{if(mode==='multi')return;const custom=mode==='custom'||$('#mode').value==='custom';level=+$('#level').value;const cfg=custom?{speed:20+(+$('#speed').value)*8,max:+$('#maxWords').value,count:80}:LEVELS[level-1];const list=custom?parseWords($('#customText').value):Array.from({length:cfg.count},()=>WORDS[Math.floor(Math.random()*WORDS.length)]);if(!list.length){$('#message').textContent='En az bir kelime gir.';return}startGame(list,cfg,'solo')};
// Lobi ve bağlantı durumuyla ilgili mesajı kullanıcıya göster.
function roomMessage(message) {
    $('#roomInfo').textContent = message;
}

// Oyun sunucusuna WebSocket bağlantısı kur.
function connect() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        return Promise.resolve();
    }

    const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
    const socketUrl = protocol + location.host + '/ws';
    ws = new WebSocket(socketUrl);

    return new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
        ws.onmessage = event => handleServer(JSON.parse(event.data));
    });
}

// Oda sunucusuna JSON biçiminde mesaj gönder.
function send(data) {
    if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

// Sunucudan gelen oda, oyuncu, oyun başlangıcı ve skor mesajlarını işle.
function handleServer(message) {
    if (message.type === 'joined') {
        room = message.room;
        isAdmin = message.admin;
        $('#roomCode').value = room;
        roomMessage(`Oda ${room} · ${isAdmin ? 'Yönetici sensin' : 'Odaya katıldın'}`);
        $('#startRoom').classList.toggle('hidden', !isAdmin);
        renderPlayers(message.players);
    }

    if (message.type === 'lobby') {
        renderPlayers(message.players);
        $('#startRoom').classList.toggle('hidden', !isAdmin);
    }

    if (message.type === 'started') {
        const delay = Math.max(0, (message.start_at - Date.now() / 1000) * 1000);
        roomMessage('Tema ve oyun ayarları geçici olarak yükleniyor...');
        setTimeout(() => {
            startGame(
                message.words,
                { speed: message.config.speed, max: message.config.max },
                'multi',
                message.theme
            );
        }, delay);
    }

    if (message.type === 'stats') {
        players = message.players;
        renderPlayers(players);
    }

    if (message.type === 'error') {
        roomMessage(message.message);
    }
}

// Oyuncu listesini avatarları ve skorlarıyla ekranda göster.
function renderPlayers(playerData) {
    const playerList = Array.isArray(playerData)
        ? playerData
        : Object.values(playerData || {});

    // Sağ panelde skor tablosu, lobi alanında yönetici etiketi gösterilir.
    $('#players').innerHTML = playerList.map(player => `
        <div class="playerLine">
            ${avatarMarkup(player.avatar || 0, 34)}
            <span>${escapeHtml(player.name || player.id)} · ${player.score || 0}</span>
        </div>
    `).join('');

    $('#lobby').innerHTML = playerList.map(player => `
        <div class="playerLine">
            ${avatarMarkup(player.avatar || 0, 38)}
            <span>${escapeHtml(player.name || player.id)} ${player.admin ? '(YÖNETİCİ)' : ''}</span>
        </div>
    `).join('');
}

$('#createRoom').onclick=async()=>{try{await connect();send({type:'create',name:playerName(),avatar:selectedAvatar})}catch(e){roomMessage('Sunucuya bağlanılamadı. launcher.py dosyasını çalıştırın.')}};$('#joinRoom').onclick=async()=>{try{await connect();send({type:'join',room:$('#roomCode').value.trim().toUpperCase(),name:playerName(),avatar:selectedAvatar})}catch(e){roomMessage('Sunucuya bağlanılamadı. launcher.py dosyasını çalıştırın.')}};
$('#startRoom').onclick=()=>{const custom=$('#multiMode').value==='custom',cfg=custom?{speed:20+(+$('#multiSpeed').value)*8,max:+$('#multiMax').value,count:80}:LEVELS[+$('#level').value-1];const list=custom?parseWords($('#multiCustomText').value):Array.from({length:cfg.count},()=>WORDS[Math.floor(Math.random()*WORDS.length)]);if(!list.length){roomMessage('Özel metin en az bir kelime içermeli.');return}send({type:'start',config:cfg,words:list,theme:readControls()})};

// Oyuncunun görünen adını profil alanından al; çok oyunculu paneldeki alanı da eşitle.
// Profildeki adı öncelikli kullan; oda formuyla aynı değerde tut.
function playerName(){const name=$('#pilotName').value.trim()||$('#nickname').value.trim()||'Oyuncu';$('#nickname').value=name;return name}

// 25 özgün, telif gerektirmeyen vektör çizgi-film avatarı üret.
// Her avatar aynı SVG şablonunu farklı renk, saç ve aksesuarla kullanır.
const AVATAR_COLORS=['#ff7b72','#ffb86b','#f6d365','#8bd5ca','#70d6ff','#82aaff','#c3a6ff','#f2a2e8','#ff8fab','#a8e6a3'];
// Avatarı harici görsel indirmeden SVG olarak tarayıcıda çiz.
function avatarMarkup(index,size=52){
  const color=AVATAR_COLORS[index%AVATAR_COLORS.length];
  const hair=['#25213b','#573b32','#171b2d','#9b5c36','#d7a84b'][Math.floor(index/5)%5];
  const accessory=index%5;
  const extras=[
    '<path d="M13 24 Q25 0 37 24 Q31 14 25 18 Q18 14 13 24" fill="'+hair+'"/>',
    '<path d="M12 24 Q10 5 25 7 Q42 7 38 25 L34 19 Q25 13 16 20Z" fill="'+hair+'"/>',
    '<path d="M13 22 Q13 4 25 5 Q39 6 38 23 L34 15 Q24 18 16 15Z" fill="'+hair+'"/>',
    '<path d="M12 25 Q9 8 25 6 Q42 8 38 26 Q34 15 25 16 Q17 15 12 25" fill="'+hair+'"/>',
    '<path d="M11 24 Q14 3 25 7 Q39 3 40 24 L35 18 L15 18Z" fill="'+hair+'"/>'
  ][accessory];
  const badge=index+1;
  return `<svg class="avatarArt" width="${
        size
    }" height="${
        size
    }" viewBox="0 0 50 50" role="img" aria-label="Avatar ${
        badge
    }"><circle cx="25" cy="25" r="24" fill="#07172b" stroke="${
        color
    }" stroke-width="2"/><path d="M8 47 Q10 34 25 34 Q40 34 42 47" fill="${
        color
    }"/><path d="M17 32 Q25 39 33 32 L31 26 H19Z" fill="#e8b18f"/><ellipse cx="25" cy="23" rx="13" ry="15" fill="#f2c6a5"/>${extras}<ellipse cx="20" cy="24" rx="1.7" ry="2.1" fill="#17243a"/><ellipse cx="30" cy="24" rx="1.7" ry="2.1" fill="#17243a"/><path d="M21 30 Q25 33 29 30" fill="none" stroke="#9b4f5a" stroke-width="1.4" stroke-linecap="round"/><path d="M17 18 Q20 15 23 17 M27 17 Q31 15 34 18" fill="none" stroke="${
        hair
    }" stroke-width="2" stroke-linecap="round"/>${index%3===0?'<path d="M8 14 L13 11 L18 14 L13 17Z" fill="#fff" opacity=".8"/>':''}<text x="25" y="46" text-anchor="middle" font-size="5" fill="#07172b" font-weight="bold">${badge}</text></svg>`;
}

// Avatar seçim düğmelerini kur ve seçilen avatarı belirginleştir.
for (let i = 0; i < 25; i++) {
  const button=document.createElement('button');
  button.type='button';
  button.className='avatarChoice'+(i===selectedAvatar?' selected':'');
  button.setAttribute('aria-label',`Avatar ${i+1} seç`);
  button.innerHTML=avatarMarkup(i,48);
  button.addEventListener('click',()=>{
    selectedAvatar=i;
    document.querySelectorAll('.avatarChoice').forEach((item,n)=>item.classList.toggle('selected',n===i));
  });
  $('#avatarPicker').append(button);
}

// Mobilde sanal klavyeyi açan gerçek metin alanından gelen karakterleri oyuna aktar.
$('#mobileInput').addEventListener('input',event=>{
  const entered=event.target.value;
  event.target.value='';
  for (const character of entered) {
    typeKey(character);
  }
});

// Mobil alandaki Backspace tuşu ve SİL düğmesi hedefteki son harfi geri alır.
$('#mobileInput').addEventListener('keydown',event=>{
  if(event.key==='Backspace'&&event.target.value===''){
    event.preventDefault();
    eraseLastCharacter();
  }
  if(event.key==='Enter'){
    event.preventDefault();
    event.target.blur();
  }
});
$('#mobileClear').addEventListener('click',()=>eraseLastCharacter());
$('#arena').addEventListener('pointerdown',()=>{
  if(state==='play'&&matchMedia('(max-width: 760px), (max-height: 560px) and (pointer: coarse)').matches)$('#mobileInput').focus();
});

// Masaüstünde kullanılan Backspace mantığını mobil kontrollerle ortaklaştır.
// Hedef kelimedeki son doğru harfi geri al.
function eraseLastCharacter(){
  if(state!=='play'||!targets[0])return;
  targets[0].typed=targets[0].typed.slice(0,-1);
  targets[0].wrongChar='';
  renderWords();
  updateHud();
}

// Hedef tamamlanınca kutu kenarını sekiz enerji parçasına ayırarak patlat.
// Tamamlanan kelimenin çerçevesini kısa süreli enerji parçacıklarına dönüştür.
function explodeTarget(){
  const target=$('#wordLayer .word.target');
  if(!target)return;
  const rect=target.getBoundingClientRect();
  const arenaRect=$('#arena').getBoundingClientRect();
  const burst=document.createElement('div');
  burst.className='wordBurst';
  burst.style.left=(rect.left-arenaRect.left)+'px';
  burst.style.top=(rect.top-arenaRect.top)+'px';
  burst.style.width=rect.width+'px';
  burst.style.height=rect.height+'px';
  for (let i = 0; i < 8; i++) {
    const shard=document.createElement('i');
    shard.style.setProperty('--angle',`${i*45}deg`);
    shard.style.setProperty('--distance',`${34+(i%3)*15}px`);
    burst.append(shard);
  }
  $('#arena').append(burst);
  sound('hit');
  setTimeout(()=>burst.remove(),650);
}

addEventListener('beforeunload',()=>ws?.close());
