import { createCanvas } from 'canvas'

type Color     = 'w' | 'b'
type PieceType = 'K'|'Q'|'R'|'B'|'N'|'P'
type Piece     = { color: Color, type: PieceType }
type Board     = (Piece | null)[][]
type Move      = { fr: number, fc: number, tr: number, tc: number, promo?: PieceType }

type GameState = {
  board:         Board
  turn:          Color
  players:       { w: string, b: string }
  chat:          string
  castling:      { wK: boolean, wQ: boolean, bK: boolean, bQ: boolean }
  enPassant:     [number,number] | null
  status:        'waiting'|'playing'|'ended'
  waitingPlayer: string | null
  winner:        string | null
  vsBot:         boolean
  botColor:      Color | null
  botLevel:      number
  lastMove:      Move | null
  moveCount:     number
  history:       string[]
}

const games = new Map<string, GameState>()

const PIECE_VALUE: Record<PieceType, number> = {
  P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000
}

const PST: Record<PieceType, number[][]> = {
  P: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [ 5,  5, 10, 25, 25, 10,  5,  5],
    [ 0,  0,  0, 20, 20,  0,  0,  0],
    [ 5, -5,-10,  0,  0,-10, -5,  5],
    [ 5, 10, 10,-20,-20, 10, 10,  5],
    [ 0,  0,  0,  0,  0,  0,  0,  0],
  ],
  N: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50],
  ],
  B: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20],
  ],
  R: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [ 5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [ 0,  0,  0,  5,  5,  0,  0,  0],
  ],
  Q: [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20],
  ],
  K: [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [ 20, 20,  0,  0,  0,  0, 20, 20],
    [ 20, 30, 10,  0,  0, 10, 30, 20],
  ],
}

const OPENING_BOOK: Move[][] = [
  [{fr:6,fc:4,tr:4,tc:4}],
  [{fr:6,fc:3,tr:4,tc:3}],
  [{fr:7,fc:6,tr:5,tc:5}],
  [{fr:6,fc:2,tr:4,tc:2}],
]

function initBoard(): Board {
  const b: Board = Array(8).fill(null).map(() => Array(8).fill(null))
  const back: PieceType[] = ['R','N','B','Q','K','B','N','R']
  for (let i = 0; i < 8; i++) {
    b[0][i] = { color:'b', type:back[i] }
    b[1][i] = { color:'b', type:'P' }
    b[6][i] = { color:'w', type:'P' }
    b[7][i] = { color:'w', type:back[i] }
  }
  return b
}

function cloneBoard(b: Board): Board {
  return b.map(r => r.map(p => p ? {...p} : null))
}

function algebraic(r: number, c: number) {
  return String.fromCharCode(97+c) + (8-r)
}

function parsePos(s: string): [number,number] | null {
  s = s.toLowerCase().trim()
  if (!/^[a-h][1-8]$/.test(s)) return null
  return [8 - parseInt(s[1]), s.charCodeAt(0) - 97]
}

function inBounds(r: number, c: number) { return r>=0&&r<8&&c>=0&&c<8 }

function isSquareAttacked(board: Board, r: number, c: number, byColor: Color): boolean {
  const opp = byColor
  const pd = opp==='w'?1:-1
  for (const dc of [-1,1])
    if (inBounds(r+pd,c+dc) && board[r+pd][c+dc]?.color===opp && board[r+pd][c+dc]?.type==='P') return true
  for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])
    if (inBounds(r+dr,c+dc) && board[r+dr][c+dc]?.color===opp && board[r+dr][c+dc]?.type==='N') return true
  for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    let rr=r+dr,cc=c+dc
    while(inBounds(rr,cc)){
      const p=board[rr][cc]; if(p){ if(p.color===opp&&(p.type==='R'||p.type==='Q')) return true; break }
      rr+=dr; cc+=dc
    }
  }
  for (const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
    let rr=r+dr,cc=c+dc
    while(inBounds(rr,cc)){
      const p=board[rr][cc]; if(p){ if(p.color===opp&&(p.type==='B'||p.type==='Q')) return true; break }
      rr+=dr; cc+=dc
    }
  }
  for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]])
    if (inBounds(r+dr,c+dc) && board[r+dr][c+dc]?.color===opp && board[r+dr][c+dc]?.type==='K') return true
  return false
}

function findKing(board: Board, col: Color): [number,number] {
  for (let r=0;r<8;r++) for (let c=0;c<8;c++)
    if (board[r][c]?.color===col && board[r][c]?.type==='K') return [r,c]
  return [-1,-1]
}

function isInCheck(board: Board, col: Color): boolean {
  const [kr,kc] = findKing(board, col)
  return isSquareAttacked(board, kr, kc, col==='w'?'b':'w')
}

function getLegalMoves(g: GameState, fr: number, fc: number): Move[] {
  const piece = g.board[fr][fc]
  if (!piece) return []
  const {color:col, type} = piece
  const raw: [number,number][] = []

  const addIfValid = (r: number, c: number): boolean => {
    if (!inBounds(r,c)) return false
    const t = g.board[r][c]
    if (t?.color===col) return false
    raw.push([r,c]); return !t
  }

  const slide = (dr: number, dc: number) => {
    let r=fr+dr,c=fc+dc
    while(inBounds(r,c)){
      const t=g.board[r][c]; if(t?.color===col) break
      raw.push([r,c]); if(t) break; r+=dr; c+=dc
    }
  }

  if (type==='P') {
    const dir=col==='w'?-1:1, start=col==='w'?6:1
    if (inBounds(fr+dir,fc) && !g.board[fr+dir][fc]) {
      raw.push([fr+dir,fc])
      if (fr===start && !g.board[fr+2*dir][fc]) raw.push([fr+2*dir,fc])
    }
    for (const dc of [-1,1]) {
      const nr=fr+dir,nc=fc+dc
      if (inBounds(nr,nc)) {
        if (g.board[nr][nc]?.color && g.board[nr][nc]?.color!==col) raw.push([nr,nc])
        if (g.enPassant?.[0]===nr && g.enPassant?.[1]===nc) raw.push([nr,nc])
      }
    }
  } else if (type==='N') {
    for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) addIfValid(fr+dr,fc+dc)
  } else if (type==='B') { for (const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) slide(dr,dc)
  } else if (type==='R') { for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) slide(dr,dc)
  } else if (type==='Q') { for (const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]) slide(dr,dc)
  } else if (type==='K') {
    for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) addIfValid(fr+dr,fc+dc)
    const row=col==='w'?7:0
    if (fr===row&&fc===4&&!isInCheck(g.board,col)) {
      if (g.castling[`${col}K` as keyof typeof g.castling] && !g.board[row][5] && !g.board[row][6] &&
          g.board[row][7]?.type==='R' && !isSquareAttacked(g.board,row,5,col==='w'?'b':'w') &&
          !isSquareAttacked(g.board,row,6,col==='w'?'b':'w'))
        raw.push([row,6])
      if (g.castling[`${col}Q` as keyof typeof g.castling] && !g.board[row][3] && !g.board[row][2] &&
          !g.board[row][1] && g.board[row][0]?.type==='R' && !isSquareAttacked(g.board,row,3,col==='w'?'b':'w'))
        raw.push([row,2])
    }
  }

  const legal: Move[] = []
  for (const [tr,tc] of raw) {
    const sim = cloneBoard(g.board)
    sim[tr][tc] = sim[fr][fc]
    sim[fr][fc] = null
    if (type==='P' && g.enPassant?.[0]===tr && g.enPassant?.[1]===tc)
      sim[col==='w'?tr+1:tr-1][tc] = null
    if (!isInCheck(sim, col)) {
      if (type==='P' && (tr===0||tr===7)) {
        for (const promo of ['Q','R','B','N'] as PieceType[])
          legal.push({fr,fc,tr,tc,promo})
      } else {
        legal.push({fr,fc,tr,tc})
      }
    }
  }
  return legal
}

function getAllLegalMoves(g: GameState, col: Color): Move[] {
  const moves: Move[] = []
  for (let r=0;r<8;r++) for (let c=0;c<8;c++)
    if (g.board[r][c]?.color===col) moves.push(...getLegalMoves(g,r,c))
  return moves
}

function applyMove(g: GameState, mv: Move): string {
  const {fr,fc,tr,tc,promo} = mv
  const piece = g.board[fr][fc]!
  let notation = algebraic(fr,fc) + algebraic(tr,tc)
  if (piece.type==='P' && g.enPassant?.[0]===tr && g.enPassant?.[1]===tc)
    g.board[piece.color==='w'?tr+1:tr-1][tc] = null
  g.enPassant = piece.type==='P' && Math.abs(tr-fr)===2 ? [fr+(tr-fr)/2,fc] : null
  if (piece.type==='K' && Math.abs(tc-fc)===2) {
    if (tc===6) { g.board[fr][5]=g.board[fr][7]; g.board[fr][7]=null }
    else        { g.board[fr][3]=g.board[fr][0]; g.board[fr][0]=null }
  }
  if (piece.type==='K') {
    g.castling[`${piece.color}K` as keyof typeof g.castling] = false
    g.castling[`${piece.color}Q` as keyof typeof g.castling] = false
  }
  if (piece.type==='R') {
    if (fc===0) g.castling[`${piece.color}Q` as keyof typeof g.castling] = false
    if (fc===7) g.castling[`${piece.color}K` as keyof typeof g.castling] = false
  }
  g.board[tr][tc] = piece
  g.board[fr][fc] = null
  if (piece.type==='P' && (tr===0||tr===7)) {
    const p = promo || 'Q'
    g.board[tr][tc] = { color: piece.color, type: p }
    notation += `=${p}`
  }
  g.lastMove = mv
  g.moveCount++
  g.history.push(notation)
  return notation
}

function evaluateBoard(board: Board): number {
  let score = 0
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const p = board[r][c]
    if (!p) continue
    const pstRow = p.color==='w' ? r : 7-r
    const val = PIECE_VALUE[p.type] + PST[p.type][pstRow][c]
    score += p.color==='w' ? val : -val
  }
  return score
}

function orderMoves(board: Board, moves: Move[]): Move[] {
  return moves.sort((a, b) => {
    const capA = board[a.tr][a.tc] ? PIECE_VALUE[board[a.tr][a.tc]!.type] : 0
    const capB = board[b.tr][b.tc] ? PIECE_VALUE[board[b.tr][b.tc]!.type] : 0
    return capB - capA
  })
}

function minimax(g: GameState, depth: number, alpha: number, beta: number, maximizing: boolean): number {
  const col: Color = maximizing ? 'w' : 'b'
  const moves = getAllLegalMoves(g, col)
  if (depth === 0 || moves.length === 0) {
    if (moves.length === 0) {
      if (isInCheck(g.board, col)) return maximizing ? -99999 + g.moveCount : 99999 - g.moveCount
      return 0
    }
    return evaluateBoard(g.board)
  }
  const ordered = orderMoves(g.board, moves)
  if (maximizing) {
    let maxEval = -Infinity
    for (const mv of ordered) {
      const savedBoard = cloneBoard(g.board)
      const savedEP    = g.enPassant
      const savedCast  = {...g.castling}
      const savedMove  = g.lastMove
      const savedCount = g.moveCount
      applyMove(g, mv)
      g.turn = 'b'
      const eval_ = minimax(g, depth-1, alpha, beta, false)
      g.board     = savedBoard
      g.enPassant = savedEP
      g.castling  = savedCast
      g.lastMove  = savedMove
      g.moveCount = savedCount
      g.turn      = 'w'
      maxEval = Math.max(maxEval, eval_)
      alpha   = Math.max(alpha, eval_)
      if (beta <= alpha) break
    }
    return maxEval
  } else {
    let minEval = Infinity
    for (const mv of ordered) {
      const savedBoard = cloneBoard(g.board)
      const savedEP    = g.enPassant
      const savedCast  = {...g.castling}
      const savedMove  = g.lastMove
      const savedCount = g.moveCount
      applyMove(g, mv)
      g.turn = 'w'
      const eval_ = minimax(g, depth-1, alpha, beta, true)
      g.board     = savedBoard
      g.enPassant = savedEP
      g.castling  = savedCast
      g.lastMove  = savedMove
      g.moveCount = savedCount
      g.turn      = 'b'
      minEval = Math.min(minEval, eval_)
      beta    = Math.min(beta, eval_)
      if (beta <= alpha) break
    }
    return minEval
  }
}

function getBotMove(g: GameState, depth: number): Move | null {
  const botCol = g.botColor!
  const moves  = getAllLegalMoves(g, botCol)
  if (!moves.length) return null
  if (g.moveCount < 10) {
    const bookMove = OPENING_BOOK[g.moveCount % OPENING_BOOK.length]?.[0]
    if (bookMove) {
      const isLegal = moves.some(m => m.fr===bookMove.fr && m.fc===bookMove.fc && m.tr===bookMove.tr && m.tc===bookMove.tc)
      if (isLegal) return bookMove
    }
  }
  const ordered    = orderMoves(g.board, moves)
  const maximizing = botCol === 'w'
  let bestMove     = ordered[0]
  let bestScore    = maximizing ? -Infinity : Infinity
  for (const mv of ordered) {
    const savedBoard = cloneBoard(g.board)
    const savedEP    = g.enPassant
    const savedCast  = {...g.castling}
    const savedMove  = g.lastMove
    const savedCount = g.moveCount
    applyMove(g, mv)
    g.turn = botCol === 'w' ? 'b' : 'w'
    const score = minimax(g, depth-1, -Infinity, Infinity, !maximizing)
    g.board     = savedBoard
    g.enPassant = savedEP
    g.castling  = savedCast
    g.lastMove  = savedMove
    g.moveCount = savedCount
    g.turn      = botCol
    if (maximizing ? score > bestScore : score < bestScore) {
      bestScore = score
      bestMove  = mv
    }
  }
  return bestMove
}

const PIECE_EMOJI: Record<string, string> = {
  'wK':'♔','wQ':'♕','wR':'♖','wB':'♗','wN':'♘','wP':'♙',
  'bK':'♚','bQ':'♛','bR':'♜','bB':'♝','bN':'♞','bP':'♟',
}

async function renderBoard(g: GameState): Promise<Buffer> {
  const SQ   = 90
  const BD_T = 36
  const BD_S = 36
  const BD_B = 52
  const W    = BD_S + SQ * 8 + BD_S
  const H    = BD_T + SQ * 8 + BD_B

  const canvas = createCanvas(W, H)
  const ctx    = canvas.getContext('2d')

  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#16213e'
  ctx.fillRect(4, 4, W-8, H-8)

  for (let r=0; r<8; r++) {
    for (let c=0; c<8; c++) {
      const x = BD_S + c * SQ
      const y = BD_T + r * SQ
      const light = (r+c)%2===0
      const isFrom = g.lastMove && g.lastMove.fr===r && g.lastMove.fc===c
      const isTo   = g.lastMove && g.lastMove.tr===r && g.lastMove.tc===c
      if (isFrom || isTo)  ctx.fillStyle = light ? '#f6f669' : '#baca2b'
      else if (light)      ctx.fillStyle = '#f0d9b5'
      else                 ctx.fillStyle = '#b58863'
      ctx.fillRect(x, y, SQ, SQ)
      const p = g.board[r][c]
      if (p?.type==='K' && isInCheck(g.board, p.color)) {
        ctx.fillStyle = 'rgba(220,50,50,0.55)'
        ctx.fillRect(x, y, SQ, SQ)
      }
      if (p) {
        const emoji = PIECE_EMOJI[p.color+p.type]
        ctx.font = `${Math.round(SQ*0.76)}px serif`
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        if (p.color==='w') {
          ctx.fillStyle = '#33333388'
          ctx.fillText(emoji, x+SQ/2+2, y+SQ/2+3)
        }
        ctx.fillStyle = p.color==='w' ? '#ffffff' : '#1a1a1a'
        ctx.fillText(emoji, x+SQ/2, y+SQ/2)
      }
    }
  }

  const coordSize = Math.round(BD_S * 0.55)
  ctx.font = `bold ${coordSize}px monospace`
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle    = '#c8a97a'
  for (let i=0; i<8; i++) {
    const letter = String.fromCharCode(97+i)
    const num    = String(8-i)
    const cx     = BD_S + i*SQ + SQ/2
    const cy     = BD_T + i*SQ + SQ/2
    ctx.fillText(letter, cx, BD_T / 2)
    ctx.fillText(letter, cx, BD_T + SQ*8 + (BD_B - 16) / 2)
    ctx.fillText(num, BD_S / 2, cy)
    ctx.fillText(num, BD_S + SQ*8 + BD_S / 2, cy)
  }

  const barY = BD_T + SQ*8 + BD_B - 12
  ctx.fillStyle = g.turn === 'w' ? '#ffffff' : '#222222'
  ctx.fillRect(BD_S, barY, SQ*8, 8)
  ctx.font = `bold ${Math.round(BD_B * 0.28)}px monospace`
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle    = g.turn === 'w' ? '#c8a97a' : '#888888'
  ctx.fillText(g.turn === 'w' ? '♔ GILIRAN PUTIH' : '♚ GILIRAN HITAM', W/2, barY - 10)

  return canvas.toBuffer('image/jpeg', { quality: 0.93 })
}

const handler = async (m: any, { Morela, reply }: any) => {
  const chatId = m.chat
  const sender = m.sender
  const text   = (m.text || '').trim()
  const parts  = text.split(/\s+/)
  const sub    = parts[1]?.toLowerCase()

  const tag = (jid: string) => `@${jid.split('@')[0]}`

  if (!sub || sub === 'help') {
    return reply(
      `♟️ *Chess Commands:*\n\n` +
      `*.chess create* — mulai game, tunggu lawan\n` +
      `*.chess join* — bergabung sebagai lawan\n` +
      `*.chess start* — mulai setelah 2 pemain join\n` +
      `*.chess bot [easy|medium|hard]* — lawan bot AI\n` +
      `*.chess delete* — hentikan game\n` +
      `*.chess e2 e4* — gerakkan bidak\n\n` +
      `*Bot AI Level:*\n` +
      `• easy   = depth 2\n` +
      `• medium = depth 4\n` +
      `• hard   = depth 6 😈\n\n` +
      `*Tip:* Putih jalan duluan!`
    )
  }

  if (sub === 'create') {
    if (games.has(chatId)) return reply('⚠️ Sudah ada game aktif! Ketik *.chess delete* dulu.')
    games.set(chatId, {
      board: initBoard(), turn: 'w',
      players: {w:'',b:''}, chat: chatId,
      castling: {wK:true,wQ:true,bK:true,bQ:true},
      enPassant: null, status:'waiting',
      waitingPlayer: sender, winner: null,
      vsBot: false, botColor: null, botLevel: 4,
      lastMove: null, moveCount: 0, history: []
    })
    return reply(`🎮 *Game dibuat!*\nKetik *.chess join* untuk bergabung\natau *.chess bot [easy/medium/hard]* lawan bot.`)
  }

  if (sub === 'bot') {
    if (games.has(chatId)) return reply('⚠️ Sudah ada game aktif!')
    const lvlMap: Record<string,number> = { easy:2, medium:4, hard:6 }
    const depth  = lvlMap[parts[2]?.toLowerCase()] || 4
    const lvlStr = Object.entries(lvlMap).find(([,v])=>v===depth)?.[0] || 'medium'
    const playerColor: Color = Math.random() < 0.5 ? 'w' : 'b'
    const botColor: Color    = playerColor === 'w' ? 'b' : 'w'
    const g: GameState = {
      board: initBoard(), turn: 'w',
      players: {
        w: playerColor==='w' ? sender : 'BOT',
        b: playerColor==='b' ? sender : 'BOT',
      },
      chat: chatId,
      castling: {wK:true,wQ:true,bK:true,bQ:true},
      enPassant: null, status:'playing',
      waitingPlayer: null, winner: null,
      vsBot: true, botColor, botLevel: depth,
      lastMove: null, moveCount: 0, history: []
    }
    games.set(chatId, g)
    let caption =
      `🤖 *Lawan Bot AI — Level: ${lvlStr.toUpperCase()}*\n\n` +
      `Kamu: ${playerColor==='w'?'♔ Putih':'♚ Hitam'}\n` +
      `Bot:  ${botColor==='w'?'♔ Putih':'♚ Hitam'}\n\n`
    if (g.turn === botColor) {
      const mv = getBotMove(g, depth)
      if (mv) {
        const notation = applyMove(g, mv)
        g.turn = g.turn === 'w' ? 'b' : 'w'
        caption += `Bot membuka dengan: *${notation.toUpperCase()}*\n\n`
      }
    }
    caption += `Giliranmu! Format: *.chess e2 e4*`
    const img = await renderBoard(g)
    await Morela.sendMessage(chatId, { image: img, caption }, { quoted: m })
    return
  }

  if (sub === 'join') {
    const g = games.get(chatId)
    if (!g) return reply('⚠️ Belum ada game. Ketik *.chess create*')
    if (g.status !== 'waiting') return reply('⚠️ Game sudah jalan.')
    if (g.waitingPlayer === sender) return reply('⚠️ Kamu yang buat game ini!')
    const rand = Math.random() < 0.5
    g.players.w = rand ? g.waitingPlayer! : sender
    g.players.b = rand ? sender : g.waitingPlayer!
    await Morela.sendMessage(chatId, {
      text:
        `🙌 *2 Pemain siap!*\n\n♔ Putih: ${tag(g.players.w)}\n♚ Hitam: ${tag(g.players.b)}\n\nKetik *.chess start* untuk mulai!`,
      mentions: [g.players.w, g.players.b]
    }, { quoted: m })
    return
  }

  if (sub === 'start') {
    const g = games.get(chatId)
    if (!g) return reply('⚠️ Belum ada game.')
    if (!g.players.w || !g.players.b) return reply('⚠️ Butuh 2 pemain dulu!')
    if (g.status === 'playing') return reply('⚠️ Game sudah berjalan.')
    g.status = 'playing'
    const img = await renderBoard(g)
    await Morela.sendMessage(chatId, {
      image: img,
      caption:
        `♟️ *Game Dimulai!*\n\n♔ Putih: ${tag(g.players.w)}\n♚ Hitam: ${tag(g.players.b)}\n\n` +
        `Giliran pertama: *Putih* ${tag(g.players.w)}\nFormat: *.chess e2 e4*`,
      mentions: [g.players.w, g.players.b]
    }, { quoted: m })
    return
  }

  if (sub === 'delete' || sub === 'stop') {
    if (!games.has(chatId)) return reply('⚠️ Tidak ada game aktif.')
    games.delete(chatId)
    return reply('🗑️ Game dihentikan.')
  }

  const g = games.get(chatId)
  if (!g || g.status !== 'playing') return

  const fromStr = sub
  const toStr   = parts[2]?.toLowerCase()
  if (!fromStr || !toStr) return

  const from = parsePos(fromStr)
  const to   = parsePos(toStr)
  if (!from || !to) return reply(`❌ Format salah. Contoh: *.chess e2 e4*`)

  const [fr,fc] = from
  const [tr,tc] = to

  if (g.vsBot && g.turn === g.botColor) return reply(`⏳ Bot sedang berpikir...`)
  if (!g.vsBot) {
    const curPlayer = g.turn==='w' ? g.players.w : g.players.b
    if (sender !== curPlayer) return reply(`⏳ Bukan giliranmu! Giliran ${tag(curPlayer)}`)
  }
  if (g.vsBot) {
    const humanColor: Color = g.players.w === sender ? 'w' : 'b'
    if (humanColor !== g.turn) return reply(`⏳ Bukan giliranmu!`)
  }

  const piece = g.board[fr][fc]
  if (!piece)                return reply(`❌ Tidak ada bidak di *${fromStr}*`)
  if (piece.color !== g.turn) return reply(`❌ Itu bukan bidakmu!`)

  const legal = getLegalMoves(g, fr, fc)
  const mv    = legal.find(mv => mv.tr===tr && mv.tc===tc)
  if (!mv) return reply(`❌ Gerakan tidak valid! *${fromStr} → ${toStr}*`)

  const notation = applyMove(g, mv)
  g.turn = g.turn==='w' ? 'b' : 'w'

  const oppMoves = getAllLegalMoves(g, g.turn)
  let gameOver  = false
  let resultMsg = ''

  if (!oppMoves.length) {
    gameOver = true
    if (isInCheck(g.board, g.turn)) {
      const winnerJid = g.vsBot
        ? (g.botColor === g.turn ? sender : 'BOT')
        : (g.turn==='w' ? g.players.b : g.players.w)
      g.winner  = winnerJid
      resultMsg = g.vsBot && winnerJid==='BOT'
        ? `\n\n🤖 *BOT MENANG! Skakmat!* 😤`
        : `\n\n♛ *SKAKMAT! ${g.vsBot ? 'Kamu menang! 🏆' : tag(winnerJid) + ' MENANG! 🏆'}*`
    } else {
      resultMsg = `\n\n🤝 *REMIS! (Stalemate)*`
    }
    g.status = 'ended'
    games.delete(chatId)
  }

  const checkMsg = !gameOver && isInCheck(g.board, g.turn)
    ? `\n⚠️ *SKAK!* ${g.vsBot ? (g.turn===g.botColor?'Bot':'Kamu') : tag(g.turn==='w'?g.players.w:g.players.b)} kena skak!`
    : ''

  let botNotation  = ''
  let botResultMsg = ''

  if (!gameOver && g.vsBot && g.turn === g.botColor) {
    await Morela.sendMessage(chatId, { text: `🤖 Bot sedang berpikir... ⏳` }, { quoted: m })
    const botMv = getBotMove(g, g.botLevel)
    if (botMv) {
      botNotation = applyMove(g, botMv)
      g.turn = g.turn==='w' ? 'b' : 'w'
      const humanMoves = getAllLegalMoves(g, g.turn)
      if (!humanMoves.length) {
        if (isInCheck(g.board, g.turn)) {
          botResultMsg = `\n\n🤖 *BOT MENANG! Skakmat!* 😤\nCoba lagi ya! *.chess bot*`
        } else {
          botResultMsg = `\n\n🤝 *REMIS! (Stalemate)*`
        }
        g.status = 'ended'
        games.delete(chatId)
      } else if (isInCheck(g.board, g.turn)) {
        botResultMsg = `\n⚠️ *SKAK!* Kamu kena skak dari bot!`
      }
    }
  }

  const img       = await renderBoard(g)
  const nextJid   = g.vsBot ? sender : (g.turn==='w' ? g.players.w : g.players.b)
  const turnEmoji = g.turn==='w' ? '♔' : '♚'
  const mentions  = g.vsBot ? [sender] : [g.players.w, g.players.b].filter(Boolean)

  let caption = `♟️ *${g.vsBot ? 'Kamu' : tag(g.turn==='b'?g.players.w:g.players.b)}* gerak: *${notation.toUpperCase()}*`
  caption += checkMsg
  caption += resultMsg
  if (botNotation) caption += `\n\n🤖 *Bot* gerak: *${botNotation.toUpperCase()}*` + botResultMsg
  if (g.status === 'playing') caption += `\n\nGiliran: ${turnEmoji} ${g.vsBot ? 'Kamu' : tag(nextJid)}`

  await Morela.sendMessage(chatId, { image: img, caption, mentions }, { quoted: m })
}

handler.command = ['chess', 'catur']
handler.tags    = ['games']
handler.help    = ['chess create|join|start|bot [easy/medium/hard]|delete|[dari] [ke]']
handler.group   = true

export default handler
