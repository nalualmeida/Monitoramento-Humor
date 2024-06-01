import express from "express";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { promisify } from 'util';
import sqlite3 from "sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));

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
        // Redirecionar para a página de dashboard após o login
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

app.get("/calendario", (req, res) => {
  res.render("calendario.ejs");
});

app.get("/atividades", (req, res) => {
  res.render("atividades.ejs");
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});