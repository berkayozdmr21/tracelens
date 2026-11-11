# TraceLens

**“Bende çalışıyor, CI’da neden bozuluyor?” sorusu için yerel inceleme aracı.** İki ortamın snapshot dosyalarını karşılaştırır; sürüm, yapılandırma, bağımlılık ve dosya sistemi farklarını log kanıtıyla gösterir.

[English README](README.md) · [Kurallar](docs/rules.md) · [Gizlilik](docs/privacy.md)

## Nasıl kullanılır?

Python 3.9+, Node 22.12+ ve .NET 10 SDK kurulu olmalıdır. Windows’ta **BASLAT.cmd** dosyasına çift tıkla. Kurulum ve derleme bittiğinde **http://127.0.0.1:9280** adresini aç. Terminal açık kalmalı. Başka projelerin portlarına dokunulmaz; 9280 veya 9281 doluysa başlatıcı açıklama gösterir.

İlk deneme için **Örnek incelemeyi aç** düğmesini kullan. Bu örnek gerçek bir şirkete ait değildir. Bilerek hatalı hazırlanmış iki ortamda 10 bulgu ve 6 log satırı vardır.

Kendi projen için:

```sh
python -m pip install .
tracelens capture --root ./projem --label Yerel --out yerel.json
# İkinci ortamda çalıştır:
tracelens capture --root ./projem --label CI --out ci.json
tracelens compare yerel.json ci.json --log build.log --out rapor.json
```

Arayüzde **Yeni inceleme** ile iki JSON dosyasını ve istersen logu ekle. Bulguları filtrele, kanıtı aç, kontrol ettiklerini işaretle ve not bırak. Notlar yeniden açılışta korunur. Arşivlenmiş inceleme geri alınabilir. Paylaşım bölümünden içeriği gözden geçirip ZIP veya ContextPilot görev metni indirilebilir.

## Neleri kontrol eder?

- Node/Python sürüm koşulları ve ana sürüm farkları; .NET hedefi için yetersiz SDK.
- Şablonda bulunan ancak hedef süreçte dolu değeri olmayan ortam anahtarları.
- Bildirilen bağımlılık aralıkları, lockfile hash’leri ve paket yöneticisi farkları.
- Harf duyarlı dosya sisteminde yerel import/dosya adı uyuşmazlıkları.
- Linux ortamına taşınan CRLF shell betikleri ve işlemci mimarisi farkları.
- Hata logunda seçilmiş satırlar ve bunların özgün satır numaraları.

## Dikkat edilmesi gerekenler

Bu araç yerel ve tek kullanıcılıdır; internetten herkese açık sunucu olarak tasarlanmamıştır. OpenAI anahtarı veya ücretli API istemez. Uygulama betiklerini çalıştırmaz, otomatik düzeltme yapmaz. Bulgular kesin kök neden iddiası değildir; aynı koşullarda yeniden test edilmelidir.

Kaynak dosyalarının gövdeleri ve ortam değişkeni değerleri snapshot’a konmaz. Bilinen gizli bilgi desenleri maskelenir; yine de dosya yolları, bağımlılık adları ve log içeriği özel olabilir. ZIP’i paylaşmadan önce incele. Yerel notlar ZIP’e girmez. İsteğe bağlı ContextPilot köprüsü kaynak kod parçaları ekleyebildiği için çıktısı ayrıca incelenmelidir.

Manuel kurulum, test komutları ve teknik sınırlar için [ana kılavuza](README.md) bak.
