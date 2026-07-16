import urllib.request
for url in ['http://localhost:8080/health','http://localhost:8080/api/auth/me']:
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(url, resp.status)
            print(resp.read().decode('utf-8')[:500])
    except Exception as e:
        print(url, 'ERROR', e)
