// language: JavaScript, file: server.js
const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Garante que a pasta /data existe (para rodar local ou no Fly.io)
const dataDir = process.env.NODE_ENV === 'production' ? '/data' : __dirname;
if (process.env.NODE_ENV === 'production' && !fs.existsSync('/data')) {
  fs.mkdirSync('/data');
}

const db = new Database(path.join(dataDir, 'database.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS pagamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time TEXT NOT NULL,
    nome TEXT NOT NULL,
    cpf TEXT NOT NULL,
    cartao TEXT NOT NULL,
    validade TEXT NOT NULL,
    valor REAL NOT NULL,
    codigo TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS logins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time TEXT NOT NULL,
    usuario TEXT NOT NULL,
    status TEXT NOT NULL,
    detalhe TEXT NOT NULL
  );
`);

const ADMIN_USER = 'admin123';
const ADMIN_PASS = 'admin123';
const sessoes = new Set();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/pagamento', (req, res) => {
  const { nome, cpf, cartao, validade } = req.body;

  if (!nome || !cpf || !cartao || !validade) {
    return res.status(400).json({ erro: 'dados incompletos' });
  }

  const cartaoLimpo = String(cartao).replace(/\D/g, '');
  const cartaoMascarado = '**** **** **** ' + cartaoLimpo.slice(-4);

  const codigo = 'PASS-' + Math.floor(1000 + Math.random() * 9000);
  const time = new Date().toISOString();

  db.prepare(`
    INSERT INTO pagamentos (time, nome, cpf, cartao, validade, valor, codigo)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(time, nome, cpf, cartaoMascarado, validade, 5.00, codigo);

  res.json({ codigo });
});

app.post('/api/login', (req, res) => {
  const { usuario, senha } = req.body;
  const time = new Date().toISOString();

  if (usuario === ADMIN_USER && senha === ADMIN_PASS) {
    const token = Math.random().toString(36).slice(2) + Date.now();
    sessoes.add(token);
    db.prepare(`INSERT INTO logins (time, usuario, status, detalhe) VALUES (?, ?, ?, ?)`)
      .run(time, usuario, 'ok', 'Login bem-sucedido');
    return res.json({ token });
  }

  db.prepare(`INSERT INTO logins (time, usuario, status, detalhe) VALUES (?, ?, ?, ?)`)
    .run(time, usuario || '(vazio)', 'fail', 'Credenciais inválidas');
  res.status(401).json({ erro: 'credenciais inválidas' });
});

function autenticar(req, res, next) {
  const token = req.headers['authorization'];
  if (!token || !sessoes.has(token)) {
    return res.status(401).json({ erro: 'não autorizado' });
  }
  next();
}

app.get('/api/pagamentos', autenticar, (req, res) => {
  const rows = db.prepare(`SELECT * FROM pagamentos ORDER BY id DESC`).all();
  res.json(rows);
});

app.get('/api/logins', autenticar, (req, res) => {
  const rows = db.prepare(`SELECT * FROM logins ORDER BY id DESC`).all();
  res.json(rows);
});

app.post('/api/logout', autenticar, (req, res) => {
  sessoes.delete(req.headers['authorization']);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`PassaFácil rodando em http://localhost:${PORT}`);
});