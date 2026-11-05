import time
import random
import requests
from concurrent.futures import ThreadPoolExecutor
from playwright.sync_api import sync_playwright

# 1. Sağlık Kontrolü (Stream Health Check): Yakalanan linkin canlı olup olmadığını test eder
def verify_stream_health(url):
    try:
        response = requests.get(url, timeout=5, headers={"User-Agent": "Mozilla/5.0"})
        if response.status_code == 200:
            return True
    except Exception:
        pass
    return False

# 2. Tekil Platform ve Kanal Tarama Görevi (Multi-Thread için)
def crawl_platform(platform):
    captured_streams = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800}
        )
        page = context.new_page()

        def handle_response(response):
            url = response.url
            # Sinema, Dizi, Film kanalları ve akış protokollerini kapsayan genişletilmiş filtre
            if any(ext in url for ext in [".m3u8", ".mpd", "manifest", "live/playlist", "chunklist", "movie", "series", "channels"]):
                if url not in captured_streams:
                    if verify_stream_health(url):
                        captured_streams.append(url)
                        print(f"[✓ AKTİF İÇERİK] {platform['name']} -> {url}")

        page.on("response", handle_response)

        try:
            print(f"[*] Taranıyor (Sinema/Dizi/Kanallar): {platform['name']} ({platform['url']})")
            page.goto(platform['url'], timeout=45000)
            page.wait_for_timeout(6000)
            
            # Sinema ve dizi kategorilerini / canlı kanalları tetiklemek için sayfa içi kaydırma simülasyonu
            for _ in range(3):
                page.mouse.wheel(0, 1000)
                page.wait_for_timeout(2500)

        except Exception as e:
            print(f"[!] {platform['name']} tarama hatası: {e}")
        finally:
            browser.close()
            
    return captured_streams

# 3. Ana Otonom Çoklu İş Parçacıklı Motor (Sinema, Dizi, Film Kanalları Dahil)
def master_stream_engine():
    # Ücretli platformların ana sayfaları ve özel sinema/dizi/canlı yayın sekmeleri
    target_platforms = [
        {"name": "Gain (Dizi/Film)", "url": "https://www.gain.tv/"},
        {"name": "Netflix (Arşiv/Filmler)", "url": "https://www.netflix.com/"},
        {"name": "BluTV (Dizi/Sinema)", "url": "https://www.blutv.com/"},
        {"name": "Digitürk / BeIN (Film/Dizi Kanalları)", "url": "https://beinsports.com.tr/"},
        {"name": "Turkcell TV+ (Sinema/Canlı Kanallar)", "url": "https://www.tvplus.com.tr/"},
        {"name": "D-Smart (Dizi/Film Kanalları)", "url": "https://dsmart.com.tr/"}
    ]

    while True:
        print("\n================ SİNEMA, DİZİ VE KANAL TARAMA DÖNGÜSÜ BAŞLIYOR ================")
        master_database = []

        with ThreadPoolExecutor(max_workers=3) as executor:
            results = executor.map(crawl_platform, target_platforms)
            for platform_results in results:
                master_database.extend(platform_results)

        print(f"\n[✓] Bu turda doğrulanan toplam sinema, dizi ve kanal akışı: {len(master_database)}")
        print("[i] Tüm içerikler M3U veritabanına aktarılmaya hazır.")

        bekleme_suresi = random.randint(30, 60)
        print(f"[Z] Döngü tamamlandı. Sonraki tarama için {bekleme_suresi} saniye bekleniyor...")
        time.sleep(bekleme_suresi)

if __name__ == "__main__":
    master_stream_engine()
