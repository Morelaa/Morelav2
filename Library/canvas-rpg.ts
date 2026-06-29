import { createCanvas, loadImage, registerFont } from 'canvas'
import path from 'path'

const FONT_DIR = path.join(process.cwd(), 'data', 'font')
const F        = 'Poppins'
let   _fr      = false

function tryRegisterFonts() {
    if (_fr) return
    try {
        registerFont(path.join(FONT_DIR, 'Poppins-Bold.ttf'),    { family: F, weight: 'bold'   })
        registerFont(path.join(FONT_DIR, 'Poppins-Medium.ttf'),  { family: F, weight: '500'    })
        registerFont(path.join(FONT_DIR, 'Poppins-Regular.ttf'), { family: F, weight: 'normal' })
        registerFont(path.join(FONT_DIR, 'Poppins-Light.ttf'),   { family: F, weight: '300'    })
        _fr = true
    } catch (e) {
        console.error('[canvas-rpg] font error:', (e as Error).message)
    }
}

function roundRect(
    ctx: any,
    x: number, y: number,
    w: number, h: number,
    r: number
) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
}

function clipCircle(ctx: any, cx: number, cy: number, r: number) {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.closePath()
}

function drawGlow(
    ctx: any, W: number, H: number,
    cx: number, cy: number, r: number,
    rv: number, gv: number, bv: number,
    alpha: number
) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, `rgba(${rv},${gv},${bv},${alpha})`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
}

function sCard(
    ctx: any,
    sx: number, sy: number,
    sw: number, sh: number,
    title: string,
    accent: string
) {
    roundRect(ctx, sx, sy, sw, sh, 10)
    ctx.fillStyle = 'rgba(12, 10, 30, 0.92)'
    ctx.fill()

    roundRect(ctx, sx, sy, sw, sh, 10)
    ctx.strokeStyle = accent + '42'
    ctx.lineWidth   = 1.5
    ctx.stroke()

    roundRect(ctx, sx, sy, sw, 3, 1.5)
    const tl = ctx.createLinearGradient(sx, 0, sx + sw, 0)
    tl.addColorStop(0,    accent)
    tl.addColorStop(0.55, accent + '88')
    tl.addColorStop(1,    'rgba(0,0,0,0)')
    ctx.fillStyle = tl
    ctx.fill()

    ctx.font      = `bold 10px "${F}"`
    ctx.fillStyle = accent
    ctx.textAlign = 'left'
    ctx.fillText(title, sx + 12, sy + 20)
}

function fitText(ctx: any, text: string, maxWidth: number): string {
    let t = text
    while (ctx.measureText(t).width > maxWidth && t.length > 2) t = t.slice(0, -1)
    return t !== text ? t + '..' : t
}

export interface RpgProfileOptions {
    name:       string
    tag:        string
    isOwn:      boolean
    isPremium:  boolean
    registered: boolean
    rpg: {
        level:          number
        exp:            number
        max_health:     number
        health:         number
        balance:        number
        bank:           number
        diamond:        number
        gold:           number
        limit_item:     number
        armor:          string
        sword:          string
        pickaxe:        string
        apel:           number
        potion:         number
        dungeon_active: boolean
        mining_active:  boolean
    }
    role:    string
    maxExp:  number
    ranks: {
        chip:    number
        money:   number
        bank:    number
        level:   number
        diamond: number
        gold:    number
        total:   number
    }
    ppBuf:   Buffer | null
    botName: string
}

export async function canvasRpgProfile(opts: RpgProfileOptions): Promise<Buffer> {
    tryRegisterFonts()

    const W = 900
    const H = 560

    const cvs = createCanvas(W, H)
    const ctx = cvs.getContext('2d') as any

    const bgGrad = ctx.createLinearGradient(0, 0, W, H)
    bgGrad.addColorStop(0,    '#07071A')
    bgGrad.addColorStop(0.45, '#0B0B20')
    bgGrad.addColorStop(1,    '#090916')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, W, H)

    ctx.strokeStyle = 'rgba(90, 65, 210, 0.04)'
    ctx.lineWidth   = 1
    for (let gx = 0; gx <= W; gx += 36) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke()
    }
    for (let gy = 0; gy <= H; gy += 36) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke()
    }

    drawGlow(ctx, W, H, 140, 290, 210, 100, 55, 230, 0.11)
    drawGlow(ctx, W, H, 760, 260, 190, 0,   175, 220, 0.09)

    const HDR_H = 48
    const hGrad = ctx.createLinearGradient(0, 0, W, 0)
    hGrad.addColorStop(0,    '#5B21B6')
    hGrad.addColorStop(0.45, '#3B82F6')
    hGrad.addColorStop(1,    '#06B6D4')
    ctx.fillStyle = hGrad
    ctx.fillRect(0, 0, W, HDR_H)

    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(0, HDR_H - 2, W, 2)

    ctx.font        = `bold 17px "${F}"`
    ctx.fillStyle   = '#FFFFFF'
    ctx.textAlign   = 'left'
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur  = 10
    ctx.fillText('⚔  RPG PROFILE', 20, 31)
    ctx.shadowBlur  = 0

    ctx.font      = `500 10px "${F}"`
    ctx.fillStyle = 'rgba(255,255,255,0.60)'
    ctx.textAlign = 'right'
    ctx.fillText(opts.botName + ' System', W - 18, 31)

    const CY   = HDR_H + 8   
    const PAD  = 12           
    const SEC  = 8            
    const LP_X = PAD
    const LP_W = 214
    const LP_H = H - CY - PAD
    const RP_X = LP_X + LP_W + 8
    const RP_W = W - RP_X - PAD

    roundRect(ctx, LP_X, CY, LP_W, LP_H, 12)
    ctx.fillStyle = 'rgba(10, 8, 28, 0.94)'
    ctx.fill()
    roundRect(ctx, LP_X, CY, LP_W, LP_H, 12)
    ctx.strokeStyle = 'rgba(100, 68, 220, 0.32)'
    ctx.lineWidth   = 1.5
    ctx.stroke()

    roundRect(ctx, LP_X, CY, 3, LP_H, 1.5)
    const lstripe = ctx.createLinearGradient(0, CY, 0, CY + LP_H)
    lstripe.addColorStop(0,   '#7C3AED')
    lstripe.addColorStop(0.5, '#0EA5E9')
    lstripe.addColorStop(1,   '#7C3AED')
    ctx.fillStyle = lstripe
    ctx.fill()

    const LP_CX = LP_X + LP_W / 2
    const AV_CY = CY + 80
    const AV_R  = 52

    ctx.save()
    ctx.shadowColor = opts.isOwn ? '#F59E0B' : opts.isPremium ? '#0EA5E9' : '#7C3AED'
    ctx.shadowBlur  = 20
    clipCircle(ctx, LP_CX, AV_CY, AV_R + 5)
    const ring = ctx.createLinearGradient(
        LP_CX - AV_R, AV_CY - AV_R,
        LP_CX + AV_R, AV_CY + AV_R
    )
    if (opts.isOwn) {
        ring.addColorStop(0, '#F59E0B'); ring.addColorStop(0.5, '#EF4444'); ring.addColorStop(1, '#F59E0B')
    } else if (opts.isPremium) {
        ring.addColorStop(0, '#0EA5E9'); ring.addColorStop(0.5, '#8B5CF6'); ring.addColorStop(1, '#0EA5E9')
    } else {
        ring.addColorStop(0, '#7C3AED'); ring.addColorStop(0.5, '#0EA5E9'); ring.addColorStop(1, '#7C3AED')
    }
    ctx.fillStyle = ring
    ctx.fill()
    ctx.restore()

    ctx.save()
    clipCircle(ctx, LP_CX, AV_CY, AV_R)
    ctx.clip()
    let ppDrawn = false
    if (opts.ppBuf) {
        try {
            const ppImg = await loadImage(opts.ppBuf)
            const s = Math.max((AV_R * 2) / ppImg.width, (AV_R * 2) / ppImg.height)
            ctx.drawImage(
                ppImg,
                LP_CX - (ppImg.width  * s) / 2,
                AV_CY - (ppImg.height * s) / 2,
                ppImg.width  * s,
                ppImg.height * s
            )
            ppDrawn = true
        } catch {  }
    }
    if (!ppDrawn) {
        const avG = ctx.createRadialGradient(LP_CX, AV_CY, 0, LP_CX, AV_CY, AV_R)
        avG.addColorStop(0, '#2A1F62')
        avG.addColorStop(1, '#0D0B24')
        ctx.fillStyle = avG
        ctx.fill()
        ctx.font      = `bold 38px sans-serif`
        ctx.fillStyle = '#8B5CF6'
        ctx.textAlign = 'center'
        ctx.fillText('👤', LP_CX, AV_CY + 14)
    }
    ctx.restore()

    const BDG_Y  = AV_CY + AV_R + 9
    const BDG_W  = 108
    const BDG_H  = 24
    const BDG_X  = LP_CX - BDG_W / 2
    const badgeC = opts.isOwn ? '#F59E0B' : opts.isPremium ? '#0EA5E9' : '#8B5CF6'
    const badgeL = opts.isOwn ? 'OWNER' : opts.isPremium ? 'PREMIUM' : 'PLAYER'

    roundRect(ctx, BDG_X, BDG_Y, BDG_W, BDG_H, 12)
    ctx.fillStyle   = badgeC + '20'; ctx.fill()
    roundRect(ctx, BDG_X, BDG_Y, BDG_W, BDG_H, 12)
    ctx.strokeStyle = badgeC; ctx.lineWidth = 1.5; ctx.stroke()
    ctx.font      = `bold 10px "${F}"`
    ctx.fillStyle = badgeC
    ctx.textAlign = 'center'
    ctx.fillText(badgeL, LP_CX, BDG_Y + 16)

    const NAME_Y = BDG_Y + 38
    ctx.font        = `bold 15px "${F}"`
    ctx.fillStyle   = '#FFFFFF'
    ctx.textAlign   = 'center'
    ctx.shadowColor = badgeC
    ctx.shadowBlur  = 8
    ctx.fillText(fitText(ctx, opts.name, LP_W - 20), LP_CX, NAME_Y)
    ctx.shadowBlur  = 0

    ctx.font      = `normal 10px "${F}"`
    ctx.fillStyle = 'rgba(148,163,184,0.70)'
    ctx.fillText(fitText(ctx, opts.tag, LP_W - 20), LP_CX, NAME_Y + 16)

    ctx.strokeStyle = 'rgba(100,75,200,0.2)'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(LP_X + 18, NAME_Y + 26); ctx.lineTo(LP_X + LP_W - 18, NAME_Y + 26)
    ctx.stroke()

    const statusLabel = opts.isOwn ? 'Owner' : opts.isPremium ? 'Premium' : 'Free'
    const statusColor = opts.isOwn ? '#F59E0B' : opts.isPremium ? '#0EA5E9' : '#22C55E'
    const roleColor   = opts.isOwn ? '#F59E0B' : '#A78BFA'

    const infoRows = [
        { label: 'Role',  value: fitText(ctx, opts.role, 90),  color: roleColor   },
        { label: 'Level', value: String(opts.rpg.level),       color: '#0EA5E9'   },
        { label: 'Status',value: statusLabel,                  color: statusColor  },
        { label: 'HP',    value: `${opts.rpg.health}/${opts.rpg.max_health}`, color: '#F87171' },
        { label: 'Reg',   value: opts.registered ? 'Yes' : 'No', color: '#4ADE80' },
    ]

    const IR_S = NAME_Y + 40
    const IR_H = 30
    infoRows.forEach((r, i) => {
        const ry = IR_S + i * IR_H
        ctx.font      = `normal 9px "${F}"`
        ctx.fillStyle = 'rgba(148,163,184,0.55)'
        ctx.textAlign = 'left'
        ctx.fillText(r.label, LP_X + 16, ry)
        ctx.font      = `bold 11px "${F}"`
        ctx.fillStyle = r.color
        ctx.textAlign = 'right'
        ctx.fillText(r.value, LP_X + LP_W - 14, ry)
        if (i < infoRows.length - 1) {
            ctx.strokeStyle = 'rgba(80,60,160,0.12)'
            ctx.lineWidth   = 1
            ctx.beginPath()
            ctx.moveTo(LP_X + 14, ry + 8); ctx.lineTo(LP_X + LP_W - 14, ry + 8)
            ctx.stroke()
        }
    })

    const GEM_Y = IR_S + infoRows.length * IR_H + 12
    const GEM_W = (LP_W - 24 - 8) / 2
    const GEM_H = 36
    const gems  = [
        { label: 'GOLD',    val: opts.rpg.gold.toLocaleString('id-ID'),    color: '#F59E0B', icon: '🪙' },
        { label: 'DIAMOND', val: opts.rpg.diamond.toLocaleString('id-ID'), color: '#67E8F9', icon: '💎' },
    ]
    gems.forEach((g, i) => {
        const gx = LP_X + 12 + i * (GEM_W + 8)
        roundRect(ctx, gx, GEM_Y, GEM_W, GEM_H, 7)
        ctx.fillStyle = g.color + '14'; ctx.fill()
        roundRect(ctx, gx, GEM_Y, GEM_W, GEM_H, 7)
        ctx.strokeStyle = g.color + '30'; ctx.lineWidth = 1; ctx.stroke()
        ctx.font      = `normal 8px "${F}"`
        ctx.fillStyle = 'rgba(148,163,184,0.55)'
        ctx.textAlign = 'center'
        ctx.fillText(g.label, gx + GEM_W / 2, GEM_Y + 12)
        ctx.font      = `bold 11px "${F}"`
        ctx.fillStyle = g.color
        ctx.fillText(fitText(ctx, g.val, GEM_W - 6), gx + GEM_W / 2, GEM_Y + 28)
    })

    ctx.font      = `300 8px "${F}"`
    ctx.fillStyle = 'rgba(80,60,160,0.40)'
    ctx.textAlign = 'center'
    ctx.fillText(`${opts.botName} • RPG Data`, LP_CX, CY + LP_H - 10)

    const S1_Y = CY
    const S1_H = 104
    sCard(ctx, RP_X, S1_Y, RP_W, S1_H, 'RPG STATS', '#8B5CF6')

    const BX_Y = S1_Y + 28
    const BX_H = 32
    const BX_W = (RP_W - 24 - 8) / 2

    roundRect(ctx, RP_X + 12, BX_Y, BX_W, BX_H, 7)
    ctx.fillStyle = 'rgba(123,92,246,0.14)'; ctx.fill()
    ctx.font      = `normal 9px "${F}"`;  ctx.fillStyle = 'rgba(148,163,184,0.55)'; ctx.textAlign = 'left'
    ctx.fillText('ROLE', RP_X + 20, BX_Y + 12)
    ctx.font      = `bold 12px "${F}"`;  ctx.fillStyle = opts.isOwn ? '#F59E0B' : '#A78BFA'
    ctx.fillText(fitText(ctx, opts.role, BX_W - 16), RP_X + 20, BX_Y + 27)

    const BX2_X = RP_X + 12 + BX_W + 8
    roundRect(ctx, BX2_X, BX_Y, BX_W, BX_H, 7)
    ctx.fillStyle = 'rgba(14,165,233,0.12)'; ctx.fill()
    ctx.font      = `normal 9px "${F}"`;  ctx.fillStyle = 'rgba(148,163,184,0.55)'; ctx.textAlign = 'left'
    ctx.fillText('LEVEL', BX2_X + 8, BX_Y + 12)
    ctx.font      = `bold 12px "${F}"`;  ctx.fillStyle = '#0EA5E9'
    ctx.fillText(String(opts.rpg.level), BX2_X + 8, BX_Y + 27)

    const EXP_Y  = BX_Y + BX_H + 8
    const BAR_W  = RP_W - 24
    const BAR_H  = 7
    const expPct = opts.isOwn ? 1 : Math.min(opts.rpg.exp / opts.maxExp, 1)

    ctx.font      = `normal 9px "${F}"`; ctx.fillStyle = 'rgba(148,163,184,0.55)'; ctx.textAlign = 'left'
    ctx.fillText('EXP', RP_X + 12, EXP_Y)
    ctx.font      = `bold 9px "${F}"`;  ctx.fillStyle = '#22C55E'; ctx.textAlign = 'right'
    ctx.fillText(`${opts.rpg.exp.toLocaleString('id-ID')} / ${opts.maxExp.toLocaleString('id-ID')}`, RP_X + RP_W - 12, EXP_Y)

    roundRect(ctx, RP_X + 12, EXP_Y + 4, BAR_W, BAR_H, 3.5)
    ctx.fillStyle = 'rgba(34,197,94,0.12)'; ctx.fill()
    const expFill = Math.max(expPct * BAR_W, 8)
    roundRect(ctx, RP_X + 12, EXP_Y + 4, expFill, BAR_H, 3.5)
    const eg = ctx.createLinearGradient(RP_X + 12, 0, RP_X + 12 + expFill, 0)
    eg.addColorStop(0, '#16A34A'); eg.addColorStop(1, '#22D3EE')
    ctx.fillStyle = eg; ctx.fill()

    const HP_Y  = EXP_Y + 18
    const hpPct = Math.min(opts.rpg.health / opts.rpg.max_health, 1)

    ctx.font      = `normal 9px "${F}"`; ctx.fillStyle = 'rgba(148,163,184,0.55)'; ctx.textAlign = 'left'
    ctx.fillText('HP', RP_X + 12, HP_Y)
    ctx.font      = `bold 9px "${F}"`;  ctx.fillStyle = '#F87171'; ctx.textAlign = 'right'
    ctx.fillText(`${opts.rpg.health} / ${opts.rpg.max_health}`, RP_X + RP_W - 12, HP_Y)

    roundRect(ctx, RP_X + 12, HP_Y + 4, BAR_W, BAR_H, 3.5)
    ctx.fillStyle = 'rgba(248,113,113,0.12)'; ctx.fill()
    const hpFill = Math.max(hpPct * BAR_W, 8)
    roundRect(ctx, RP_X + 12, HP_Y + 4, hpFill, BAR_H, 3.5)
    const hg = ctx.createLinearGradient(RP_X + 12, 0, RP_X + 12 + hpFill, 0)
    hg.addColorStop(0, '#EF4444'); hg.addColorStop(1, '#F97316')
    ctx.fillStyle = hg; ctx.fill()

    const S2_Y = S1_Y + S1_H + SEC
    const S2_H = 80
    sCard(ctx, RP_X, S2_Y, RP_W, S2_H, 'ASSETS', '#F59E0B')

    const assets = [
        { label: 'BALANCE', val: 'Rp ' + opts.rpg.balance.toLocaleString('id-ID'), color: '#F59E0B' },
        { label: 'BANK',    val: 'Rp ' + opts.rpg.bank.toLocaleString('id-ID'),    color: '#22C55E' },
        { label: 'LIMIT',   val: String(opts.rpg.limit_item),                       color: '#FB923C' },
    ]
    const AW = (RP_W - 24 - 16) / 3
    assets.forEach((a, i) => {
        const ax = RP_X + 12 + i * (AW + 8)
        const ay = S2_Y + 26
        roundRect(ctx, ax, ay, AW, 40, 7)
        ctx.fillStyle = a.color + '12'; ctx.fill()
        roundRect(ctx, ax, ay, AW, 40, 7)
        ctx.strokeStyle = a.color + '28'; ctx.lineWidth = 1; ctx.stroke()
        ctx.font      = `normal 8px "${F}"`; ctx.fillStyle = 'rgba(148,163,184,0.55)'; ctx.textAlign = 'center'
        ctx.fillText(a.label, ax + AW / 2, ay + 13)
        ctx.font      = `bold 10px "${F}"`; ctx.fillStyle = a.color
        ctx.fillText(fitText(ctx, a.val, AW - 6), ax + AW / 2, ay + 31)
    })

    const S3_Y = S2_Y + S2_H + SEC
    const S3_H = 108
    sCard(ctx, RP_X, S3_Y, RP_W, S3_H, 'RANKINGS', '#06B6D4')

    const ranks = [
        { label: 'CHIP',    rank: opts.ranks.chip    },
        { label: 'MONEY',   rank: opts.ranks.money   },
        { label: 'BANK',    rank: opts.ranks.bank    },
        { label: 'LEVEL',   rank: opts.ranks.level   },
        { label: 'DIAMOND', rank: opts.ranks.diamond },
        { label: 'GOLD',    rank: opts.ranks.gold    },
    ]
    const RCW = (RP_W - 24 - 10) / 3
    const RRH = 34
    ranks.forEach((r, i) => {
        const col  = i % 3
        const row  = Math.floor(i / 3)
        const rx   = RP_X + 12 + col * (RCW + 5)
        const ry   = S3_Y + 26 + row * (RRH + 5)
        const top1 = r.rank === 1
        const top3 = r.rank <= 3
        const rc   = top1 ? '#F59E0B' : top3 ? '#06B6D4' : 'rgba(148,163,184,0.60)'

        roundRect(ctx, rx, ry, RCW, RRH, 5)
        ctx.fillStyle = top1 ? 'rgba(245,158,11,0.10)' : 'rgba(18,16,45,0.80)'; ctx.fill()

        ctx.font      = `normal 8px "${F}"`;  ctx.fillStyle = 'rgba(110,120,145,0.60)'; ctx.textAlign = 'left'
        ctx.fillText('TOP ' + r.label, rx + 5, ry + 12)
        ctx.font      = `bold 14px "${F}"`;  ctx.fillStyle = rc
        ctx.fillText('#' + r.rank, rx + 5, ry + 29)
        ctx.font      = `normal 8px "${F}"`;  ctx.fillStyle = 'rgba(90,100,125,0.50)'; ctx.textAlign = 'right'
        ctx.fillText('/' + opts.ranks.total, rx + RCW - 4, ry + 29)
    })

    const S4_Y  = S3_Y + S3_H + SEC
    const S4_H  = H - S4_Y - PAD
    const COL_W = (RP_W - 2 * SEC) / 3

    const T_X = RP_X
    sCard(ctx, T_X, S4_Y, COL_W, S4_H, 'TOOLS', '#A78BFA')
    const tools = [
        { label: 'Armor',   val: opts.rpg.armor   },
        { label: 'Sword',   val: opts.rpg.sword   },
        { label: 'Pickaxe', val: opts.rpg.pickaxe },
    ]
    tools.forEach((t, i) => {
        const ty    = S4_Y + 27 + i * 29
        const isGod = t.val.includes('God') || t.val.includes('⚡')
        ctx.font      = `normal 9px "${F}"`; ctx.fillStyle = 'rgba(148,163,184,0.55)'; ctx.textAlign = 'left'
        ctx.fillText(t.label, T_X + 10, ty)
        ctx.font      = `bold 9px "${F}"`;  ctx.fillStyle = isGod ? '#F59E0B' : '#A78BFA'; ctx.textAlign = 'right'
        ctx.fillText(fitText(ctx, t.val, COL_W - 65), T_X + COL_W - 8, ty)
    })

    const I_X = RP_X + COL_W + SEC
    sCard(ctx, I_X, S4_Y, COL_W, S4_H, 'ITEMS', '#F472B6')
    const items = [
        { label: 'Apel',   val: String(opts.rpg.apel)   },
        { label: 'Potion', val: String(opts.rpg.potion) },
    ]
    items.forEach((it, i) => {
        const iy = S4_Y + 27 + i * 29
        ctx.font      = `normal 9px "${F}"`; ctx.fillStyle = 'rgba(148,163,184,0.55)'; ctx.textAlign = 'left'
        ctx.fillText(it.label, I_X + 10, iy)
        ctx.font      = `bold 12px "${F}"`;  ctx.fillStyle = '#F472B6'; ctx.textAlign = 'right'
        ctx.fillText(it.val, I_X + COL_W - 8, iy)
    })

    const A_X = RP_X + 2 * (COL_W + SEC)
    sCard(ctx, A_X, S4_Y, COL_W, S4_H, 'ACTIVITY', '#34D399')
    const acts = [
        { label: 'Dungeon', active: opts.rpg.dungeon_active },
        { label: 'Mining',  active: opts.rpg.mining_active  },
    ]
    acts.forEach((ac, i) => {
        const ay = S4_Y + 27 + i * 29
        ctx.font      = `normal 9px "${F}"`; ctx.fillStyle = 'rgba(148,163,184,0.55)'; ctx.textAlign = 'left'
        ctx.fillText(ac.label, A_X + 10, ay)
        ctx.font      = `bold 10px "${F}"`;  ctx.fillStyle = ac.active ? '#34D399' : '#F87171'; ctx.textAlign = 'right'
        ctx.fillText(ac.active ? 'ACTIVE' : 'OFF', A_X + COL_W - 8, ay)
    })

    return cvs.toBuffer('image/png')
}
