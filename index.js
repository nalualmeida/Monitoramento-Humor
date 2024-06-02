import express from "express";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { promisify } from 'util';
import sqlite3 from "sqlite3";
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import session from 'express-session';
import crypto from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));

const secret = crypto.randomBytes(64).toString('hex');

app.use(session({
  secret: secret,
  resave: false,
  saveUninitialized: true
}));

const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/login'); // ou enviar uma resposta de erro
  }
  next();
};

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
      cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
      cb(null, `${Date.now()}_${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|mp3|wav|m4a/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
      return cb(null, true);
  } else {
      cb('Error: Arquivo não suportado!');
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter
});

app.use('/uploads', express.static('uploads'));

// Conexão banco de dados SQLite
let db = new sqlite3.Database('./DB-Monitoramento Humor', (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
  } else {
    console.log('Conexão bem sucedida ao banco de dados.');
  }
});

const dbGet = promisify(db.get).bind(db);
const dbAll = promisify(db.all).bind(db);
const dbRun = promisify(db.run).bind(db);

app.set('view engine', 'ejs');
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.get("/signup", (req, res) => {
  res.render("signup.ejs");
});

app.post("/signup", async (req, res) => {
  const { nome_usuario, email, senha } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(senha, 10);
    const user = await dbGet("SELECT * FROM users WHERE email = ?", [email]);

    if (user) {
      res.send("Este usuário já existe! Tente fazer login em sua conta.");
    } else {
      await dbRun(
        `INSERT INTO users (nome_usuario, email, senha) VALUES (?, ?, ?)`,
        [nome_usuario, email, hashedPassword]
      );
      req.session.userId = email; // Configurar a sessão com o email do usuário
      console.log("Novo usuário registrado e autenticado, ID do usuário:", req.session.userId);
      return res.redirect("/inicioDashboard");
    }
  } catch (err) {
    console.error('Erro ao verificar usuário:', err.message);
    res.status(500).send('Erro interno do servidor');
  }
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  try {
    const user = await dbGet("SELECT * FROM users WHERE email = ?", [email]);
    if (user) {
      const senhaCorreta = await bcrypt.compare(senha, user.senha);
      if (senhaCorreta) {
        req.session.userId = user.email;
        console.log("Usuário autenticado, ID do usuário:", req.session.userId);
        res.redirect("/dashboard");
      } else {
        res.send("Senha incorreta");
      }
    } else {
      res.send("Usuário não encontrado");
    }
  } catch (err) {
    console.log(err);
    res.status(500).send('Erro interno do servidor');
  }
});

app.get("/dashboard", requireAuth, async (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
      return res.redirect("/login");
  }

  try {
    const registros = await dbAll(
      "SELECT * FROM addHumor WHERE id_usuario = ? ORDER BY data_atual DESC",
      [userId]
    );

      if (registros.length > 0) {
          res.render("dashboard", { registros });
      } else {
          res.render("inicioDashboard");
      }
  } catch (err) {
      console.error("Erro ao obter registros:", err.message);
      res.status(500).send("Erro ao carregar o dashboard");
  }
});

app.get("/inicioDashboard", requireAuth, (req, res) => {
  res.render("inicioDashboard.ejs");
});

app.get("/estatisticas", requireAuth, (req, res) => {
  res.render("estatisticas.ejs");
});

app.get("/addHumor", requireAuth, (req, res) => {
  res.render("addHumor.ejs");
});

// app.post("/addHumor", upload.fields([{ name: 'foto' }, { name: 'audio' }]), async (req, res) => {
//   const { data_hora_atual, avaliacao_humor, emocoes, sono, social, clima, anotacao } = req.body;
//   const foto = req.files['foto'] ? req.files['foto'][0].filename : null;
//   const audio = req.files['audio'] ? req.files['audio'][0].filename : null;
//   try {
//       await dbRun(
//           `INSERT INTO addHumor (data_atual, avaliacao_humor, emocoes, sono, social, clima, anotacao, foto, audio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//           [data_hora_atual, avaliacao_humor, emocoes, sono, social, clima, anotacao, foto, audio]
//       );
//       res.redirect("/inicioDashboard");
//   } catch (err) {
//       console.error('Erro ao salvar humor:', err.message);
//       res.status(500).send('Erro ao salvar humor');
//   }
// });

// app.post("/addHumor", upload.fields([{ name: 'foto' }, { name: 'audio' }]), async (req, res) => {
//   const { data_atual, avaliacao_humor, emocoes, sono, social, clima, anotacao } = req.body;
//   const foto = req.files['foto'] ? req.files['foto'][0].filename : null;
//   const audio = req.files['audio'] ? req.files['audio'][0].filename : null;

//   console.log("ID do usuário na sessão:", req.session.userId); // Adicione este log

//   if (!req.session.userId) {
//     return res.status(401).send('Usuário não autenticado');
//   }

//   let audioFilename = null;
//   if (audioData) {
//     const base64Data = audioData.split(',')[1];
//     audioFilename = `${req.session.userId}-${Date.now()}.wav`;
//     const audioPath = path.join(__dirname, 'uploads', audioFilename);
//     fs.writeFileSync(audioPath, Buffer.from(base64Data, 'base64'));
//   }

//   const dataAtual = data_atual ? new Date(data_atual).toISOString().split('T')[0] : null;

//   try {
//     await dbRun(
//       `INSERT INTO addHumor (id_usuario, data_atual, avaliacao_humor, emocoes, sono, social, clima, anotacao, foto, audio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//       [req.session.userId, dataAtual, avaliacao_humor, emocoes, sono, social, clima, anotacao, foto, audioFilename]
//     );
//     res.redirect("/inicioDashboard");
//   } catch (err) {
//     console.error('Erro ao salvar humor:', err.message);
//     res.status(500).send('Erro ao salvar humor');
//   }
// });

app.post("/addHumor", requireAuth, upload.fields([{ name: 'foto' }, { name: 'audio' }]), async (req, res) => {
  console.log(req.files);
  const { data_atual, avaliacao_humor, emocoes, sono, social, clima, anotacao } = req.body;
  const foto = req.files['foto'] ? req.files['foto'][0].filename : null;
  const audio = req.files['audio'] ? req.files['audio'][0].filename : null;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).send('Usuário não autenticado');
  }

  // Validação dos campos obrigatórios
  if (!data_atual || !avaliacao_humor) {
    return res.status(400).send('Data atual e avaliação de humor são obrigatórios.');
  }

  const dataAtual = data_atual ? new Date(data_atual).toISOString().split('T')[0] : null;

  try {
    await dbRun(
      `INSERT INTO addHumor (id_usuario, data_atual, avaliacao_humor, emocoes, sono, social, clima, anotacao, foto, audio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, dataAtual, avaliacao_humor, emocoes, sono, social, clima, anotacao, foto, audio]
    );
    res.redirect("/dashboard");
  } catch (err) {
    console.error('Erro ao salvar humor:', err.message);
    res.status(500).send('Erro ao salvar humor');
  }
});

app.get("/calendario", requireAuth, (req, res) => {
  res.render("calendario.ejs");
});

app.get('/calendario', requireAuth, (req, res) => {
  res.sendFile(__dirname + "/calendario.ejs");

});

app.get('/humor-dados', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { startDate, endDate } = req.query;

  if (!userId) {
    return res.status(401).send('Usuário não autenticado');
  }

  try {
    const rows = await dbAll(
      `SELECT data_atual, avaliacao_humor FROM addHumor WHERE id_usuario = ? AND data_atual BETWEEN ? AND ?`,
      [userId, startDate, endDate]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar dados de humor:', err.message);
    res.status(500).send('Erro ao buscar dados de humor');
  }
});


app.get("/atividades", requireAuth, (req, res) => {
  res.render("atividades.ejs");
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});