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
app.use(express.urlencoded({ extended: true }));

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

app.get("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error("Erro ao encerrar sessão:", err);
      return res.status(500).send("Erro ao encerrar sessão");
    }
    res.redirect("/login");
  });
});

app.get("/dashboard", requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const user = await dbGet('SELECT nome_usuario, email FROM users WHERE email = ?', [userId]);

  if (!userId) {
      return res.redirect("/login");
  }

  try {
    const registros = await dbAll(
      "SELECT * FROM addHumor WHERE id_usuario = ? ORDER BY data_atual DESC",
      [userId]
    );

      if (registros.length > 0) {
          res.render("dashboard", { user: user, registros: registros });
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

// app.get("/getMoodData", requireAuth, async (req, res) => {
//   const userId = req.session.userId;

//   try {
//     const registros = await dbAll(
//       "SELECT data_atual, avaliacao_humor FROM addHumor WHERE id_usuario = ? ORDER BY data_atual",
//       [userId]
//     );

//     if (registros.length === 0) {
//       return res.json({ anual: { labels: [], moodValues: [] }, mensal: { labels: [], moodValues: [] }, contagem: [] });
//     }

//     const moodData = registros.reduce((acc, registro) => {
//       const data = new Date(registro.data_atual);
//       const year = data.getFullYear();
//       const monthDB = data.getMonth();
//       const day = data.getDate();
//       const mood = registro.avaliacao_humor;
      
//       // Agrupando dados por mês para a visualização anual
//       if (!acc.anual[monthDB]) {
//         acc.anual[monthDB] = [];
//       }
//       acc.anual[monthDB].push({ day, mood });

//       // Agrupando dados por dia para a visualização mensal
//       const dateString = data.toLocaleDateString();
//       if (!acc.mensal[dateString]) {
//         acc.mensal[dateString] = [];
//       }
//       acc.mensal[dateString].push(mood);

//       // Calculando contagem de humores
//       acc.contagem[mood] = (acc.contagem[mood] || 0) + 1;

//       return acc;
//     }, { anual: {}, mensal: {}, contagem: {} });

//     const mesesDoAno = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
//     const labelsAnual = mesesDoAno.map((monthAbbrev, index) => {
//       const monthName = new Date(0, index).toLocaleString('default', { month: 'short' });
//       return monthName.charAt(0).toUpperCase();;
//   });
//     const moodValuesAnual = Object.values(moodData.anual).map(monthData => {
//       const moodSum = monthData.reduce((sum, { mood }) => sum + (mood === 'excelente' ? 5 : mood === 'bem' ? 4 : mood === 'mais ou menos' ? 3 : mood === 'mal' ? 2 : 1), 0);
//       return moodSum / monthData.length;
//     });

//     const labelsMensal = Object.keys(moodData.mensal);
//     const moodValuesMensal = Object.values(moodData.mensal).map(dayData => {
//       const moodSum = dayData.reduce((sum, mood) => sum + (mood === 'excelente' ? 5 : mood === 'bem' ? 4 : mood === 'mais ou menos' ? 3 : mood === 'mal' ? 2 : 1), 0);
//       return moodSum / dayData.length;
//     });

//     res.json({
//       anual: { labels: labelsAnual, moodValues: moodValuesAnual },
//       mensal: { labels: labelsMensal, moodValues: moodValuesMensal },
//       contagem: Object.values(moodData.contagem),
//       streak: 0 // Não está claro como calcular o streak, pode precisar ser revisado
//     });
//   } catch (err) {
//     console.error('Erro ao obter dados de humor:', err.message);
//     res.status(500).send('Erro ao obter dados de humor');
//   }
// });

app.get("/getMoodData", requireAuth, async (req, res) => {
  const userId = req.session.userId;

  try {
    const registros = await dbAll(
      "SELECT data_atual, avaliacao_humor FROM addHumor WHERE id_usuario = ? ORDER BY data_atual",
      [userId]
    );

    if (registros.length === 0) {
      return res.json({ anual: { labels: [], moodValues: [] }, contagem: {} });
    }

    // Inicializar moodData com todos os meses do ano
    const moodData = {
      anual: Array.from({ length: 12 }, () => []),
      contagem: {}
    };

    registros.forEach(registro => {
      const data = new Date(registro.data_atual);
      const monthDB = data.getMonth();
      const mood = registro.avaliacao_humor;

      // Adicionar registro ao mês correspondente
      moodData.anual[monthDB].push(mood);

      // Calcular contagem de humores
      moodData.contagem[mood] = (moodData.contagem[mood] || 0) + 1;
    });

    const mesesDoAno = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const labelsAnual = mesesDoAno.map((monthAbbrev, index) => {
      const monthName = new Date(0, index).toLocaleString('default', { month: 'short' });
      return monthName.charAt(0).toUpperCase();
    });

    const reverseMoodMap = {
      'excelente': 5,
      'bem': 4,
      'mais ou menos': 3,
      'mal': 2,
      'horrível': 1
    };

    const moodValuesAnual = moodData.anual.map(monthData => {
      if (monthData.length === 0) {
        return 0; // Sem registros para este mês
      }

      const moodSum = monthData.reduce((sum, mood) => {
        return sum + reverseMoodMap[mood];
      }, 0);

      return moodSum / monthData.length;
    });

    res.json({
      anual: { labels: labelsAnual, moodValues: moodValuesAnual },
      contagem: moodData.contagem,
      streak: 0 // Não sei como calcular
    });
  } catch (err) {
    console.error('Erro ao obter dados de humor:', err.message);
    res.status(500).send('Erro ao obter dados de humor');
  }
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
  const { data_atual, avaliacao_humor, emocoes, sono, social, clima, anotacao } = req.body;
  const foto = req.files['foto'] ? req.files['foto'][0].filename : null;
  const audio = req.files['audio'] ? req.files['audio'][0].filename : null;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).send('Usuário não autenticado');
  }

  const existingRecord = await dbGet(
    "SELECT * FROM addHumor WHERE id_usuario = ? AND data_atual = ?",
    [userId, data_atual]
  );

  if (existingRecord) {
    return res.status(400).send("Já existe um registro para esta data");
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

app.get("/editHumor", requireAuth, (req, res) => {
  res.render("editHumor.ejs");
});

app.get("/editHumor/:id", async (req, res) => {
  console.log("A rota /editHumor/:id foi acessada."); 
  const userId = req.session.userId;
  const registroId = req.params.id;

  if (!userId) {
    return res.redirect("/login");
  }

  try {
    const registro = await dbGet(
      "SELECT * FROM addHumor WHERE id_registro = ?",
      [registroId]
    );
    console.log("Registro encontrado:", registro)

    if (registro) {
      res.render("editHumor", { registro });
    } else {
      res.status(404).send("Registro não encontrado");
    }
  } catch (err) {
    console.error("Erro ao obter registro:", err.message);
    res.status(500).send("Erro ao carregar a página de edição");
  }
});

// Rota para processar a edição
app.post("/editHumor/:id", requireAuth, upload.fields([{ name: 'foto' }, { name: 'audio' }]), async (req, res) => {
  const { data_atual, avaliacao_humor, emocoes, sono, social, clima, anotacao } = req.body;
  const userId = req.session.userId;
  const registroId = req.params.id;

  console.log('Dados recebidos:', { data_atual, avaliacao_humor, emocoes, sono, social, clima, anotacao });

  if (!userId) {
    return res.status(401).send('Usuário não autenticado');
  }

  const dataAtual = data_atual ? new Date(data_atual).toISOString().split('T')[0] : null;

  const existingRecord = await dbGet(
    "SELECT * FROM addHumor WHERE id_registro != ? AND id_usuario = ? AND data_atual = ?",
    [registroId, userId, data_atual]
  );

  if (existingRecord) {
    return res.status(400).send("Já existe um registro para esta data");
  }

  // Validação dos campos obrigatórios
  if (!data_atual || !avaliacao_humor) {
    return res.status(400).send('Data atual e avaliação de humor são obrigatórios.');
  }

  try {
    await dbRun(
      `UPDATE addHumor SET data_atual = ?, avaliacao_humor = ?, emocoes = ?, sono = ?, social = ?, clima = ?, anotacao = ? WHERE id_registro = ?`,
      [dataAtual, avaliacao_humor, emocoes, sono, social, clima, anotacao, registroId]
    );

    res.redirect("/dashboard");
  } catch (err) {
    console.error("Erro ao editar registro:", err.message);
    res.status(500).send("Erro ao editar o registro");
  }
});

// Rota para excluir o registro
app.post("/deleteHumor/:id", async (req, res) => {
  const userId = req.session.userId;
  const registroId = req.params.id;

  if (!userId) {
    return res.redirect("/login");
  }

  try {
    const registro = await dbGet(
      "SELECT * FROM addHumor WHERE id_registro = ?",
      [registroId]
    );

    if (registro.foto) {
      const fotoPath = path.join(__dirname, 'uploads', registro.foto);
      fs.unlink(fotoPath, (err) => {
        if (err) console.error("Erro ao excluir arquivo de foto:", err.message);
      });
    }
    if (registro.audio) {
      const audioPath = path.join(__dirname, 'uploads', registro.audio);
      fs.unlink(audioPath, (err) => {
        if (err) console.error("Erro ao excluir arquivo de áudio:", err.message);
      });
    }

    await dbRun(
      "DELETE FROM addHumor WHERE id_registro = ?",
      [registroId]
    );
  
    res.redirect("/dashboard");
  } catch (err) {
    console.error("Erro ao excluir registro:", err.message);
    res.status(500).send("Erro ao excluir o registro");
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