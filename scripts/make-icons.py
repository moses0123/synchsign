from PIL import Image, ImageDraw
import math

def bez(p0, p1, p2, p3, n=80):
    pts = []
    for i in range(n + 1):
        t = i / n
        x = (1-t)**3*p0[0] + 3*(1-t)**2*t*p1[0] + 3*(1-t)*t**2*p2[0] + t**3*p3[0]
        y = (1-t)**3*p0[1] + 3*(1-t)**2*t*p1[1] + 3*(1-t)*t**2*p2[1] + t**3*p3[1]
        pts.append((x, y))
    return pts

def dense(pts):
    out = []
    for a, b in zip(pts, pts[1:]):
        n = max(1, int(math.dist(a, b) / 2))
        out += [(a[0] + (b[0]-a[0])*i/n, a[1] + (b[1]-a[1])*i/n) for i in range(n)]
    return out + [pts[-1]]

def icon(size, pad_ratio=0.0, radius_ratio=0.23, bg_full=False):
    S = size * 4
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    # gradient
    grad = Image.new("RGBA", (S, S))
    gd = ImageDraw.Draw(grad)
    top, bot = (56, 189, 248), (2, 132, 199)
    for y in range(S):
        t = y / S
        c = tuple(int(top[i] * (1 - t) + bot[i] * t) for i in range(3)) + (255,)
        gd.line([(0, y), (S, y)], fill=c)
    mask = Image.new("L", (S, S), 0)
    md = ImageDraw.Draw(mask)
    if bg_full:
        md.rectangle([0, 0, S, S], fill=255)
    else:
        md.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * radius_ratio), fill=255)
    img.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(img)
    k = S * (1 - 2 * pad_ratio)
    o = S * pad_ratio
    P = lambda x, y: (o + x * k, o + y * k)
    # signature "S" stroke
    pts = bez(P(.70, .26), P(.42, .14), P(.22, .34), P(.44, .47), 120) + \
          bez(P(.44, .47), P(.68, .60), P(.60, .80), P(.30, .74), 120)
    w = int(k * 0.085)
    for p in dense(pts):
        d.ellipse([p[0]-w/2, p[1]-w/2, p[0]+w/2, p[1]+w/2], fill="white")
    # underline flourish
    ul = bez(P(.22, .84), P(.45, .80), P(.62, .86), P(.80, .80), 80)
    w2 = int(k * 0.04)
    for p in dense(ul):
        d.ellipse([p[0]-w2/2, p[1]-w2/2, p[0]+w2/2, p[1]+w2/2], fill=(224, 242, 254, 255))
    return img.resize((size, size), Image.LANCZOS)

icon(192).save("public/icons/icon-192.png")
icon(512).save("public/icons/icon-512.png")
icon(512, pad_ratio=0.12, bg_full=True).save("public/icons/maskable-512.png")
icon(180, bg_full=True).save("public/icons/apple-touch-icon.png")
icon(48).save("src/app/favicon.ico", sizes=[(48, 48), (32, 32), (16, 16)])
print("ok")
