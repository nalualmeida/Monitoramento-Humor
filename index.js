import express from "express";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { promisify } from 'util';
import sqlite3 from "sqlite3";
import multer from 'multer';
import path from 'path'; 
import session from 'express-session';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: '1234',
  resave: false,
  saveUninitialized: true
}));

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
  // limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limite de tamanho do arquivo
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
      res.redirect("/inicioDashboard");
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
              req.session.userId = user.id_usuario; 
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


app.get("/dashboard", (req, res) => {
  res.render("dashboard.ejs");
});

app.get("/inicioDashboard", (req, res) => {
  res.render("inicioDashboard.ejs");
});

app.get("/estatisticas", (req, res) => {
  res.render("estatisticas.ejs");
});

app.get("/addHumor", (req, res) => {
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
app.post("/addHumor", upload.fields([{ name: 'foto' }, { name: 'audio' }]), async (req, res) => {
  const { data_hora_atual, avaliacao_humor, emocoes, sono, social, clima, anotacao } = req.body;
  const foto = req.files['foto'] ? req.files['foto'][0].filename : null;
  const audio = req.files['audio'] ? req.files['audio'][0].filename : null;
  const userId = req.session.userId;

  if (!userId) {
      return res.status(401).send('Usuário não autenticado');
  }

  try {
      await dbRun(
          `INSERT INTO addHumor (id_usuario, data_atual, avaliacao_humor, emocoes, sono, social, clima, anotacao, foto, audio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, data_hora_atual, avaliacao_humor, emocoes, sono, social, clima, anotacao, foto, audio]
      );
      res.redirect("/inicioDashboard");
  } catch (err) {
      console.error('Erro ao salvar humor:', err.message);
      res.status(500).send('Erro ao salvar humor');
  }
});


app.get("/calendario", (req, res) => {
  res.render("calendario.ejs");
});

app.get("/atividades", (req, res) => {
  res.render("atividades.ejs");
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});