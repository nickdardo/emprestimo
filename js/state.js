// ════════════════════════════════════════════════════════════════
// STATE — Estado global compartilhado entre módulos
// Listas (tomadores, emprestimos, parcelas, users), seleção atual,
// e flags de sort/filter. São declaradas com `let` no escopo global
// para que todos os outros módulos possam ler e escrever nelas.
// ════════════════════════════════════════════════════════════════

// ══ STATE ══
let tomadores=[],emprestimos=[],parcelas=[],users=[];
let editEmp=null,editTom=null,editUsr=null,curPage='dashboard';


// ── CALCULADORA ──
let _calcVal='0', _calcOp=null, _calcPrev=null, _calcNewNum=true;

// ── CALENDÁRIO ──
let _calY = new Date().getFullYear(), _calM = new Date().getMonth();

// ── WHATSAPP ──
let _whatsAppData = null;
let _whatsAppOriginalContent = null;

// ── LEMBRAR ACESSO ──
let _remember = false;

// ── DASHBOARD ──
let _dashUserId = null; // null = todos (admin), ou id do usuário filtrado

// ── EMPRÉSTIMOS ──
let _selectMode = false;
let _empSort = {col:'data', dir:'desc'};
let _tomSort = {col:null, dir:'asc'};
let _empFilter = 'todos';
let _empTipo = 'juros';

// ── FILTROS DE VENCIMENTO ──
let filtroAtivo = null; // null, 'hoje', '3dias', '7dias'
