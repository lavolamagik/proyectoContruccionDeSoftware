import express from 'express'
import cors from 'cors'
import { Collection, MongoClient, ObjectId } from 'mongodb'
import http from 'http'
import dotenv from 'dotenv'
import { log } from 'console'
import nodemailer from 'nodemailer'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

dotenv.config()

// Configuración de la aplicación
const url = process.env.MONGODB_URI
const app = express()
const SECRET_KEY = '8jP@4k#Dq^2Lw!x9u&T7zR*Y0o'

const client = new MongoClient(url)
let db

// Configuración de CORS
const corsOptions = {
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'DELETE', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization']
}



app.use(cors(corsOptions))
app.use(express.json())
// Conexión a la base de datos de MongoDB
client
  .connect()
  .then(() => {
    db = client.db('construDatabase')
  })
  .catch((error) => {
    console.error('Failed to connect to database', error)
  })

// Iniciar el servidor
const PORT = process.env.PORT || 8080
const server = http.createServer(app)
server.listen(PORT, () => console.log(`Server running on port ${PORT}`))

// ########## Metodos ##########

app.get('/users', async (req, res) => {
  try {
    const database = client.db('construccion')
    const collection = database.collection('users')
    const users = await collection.find().toArray()
    res.send(users)
  } catch (error) {
    console.error('Failed to fetch users from database', error)
    res.status(500).send('Failed to fetch users from database')
  }
})

app.get('/name/:id', async (req, res) => {
  try {
    const database = client.db('construccion')
    const collection = database.collection('evaluaciones')
    const evaluations = await collection.findOne({ _id: new ObjectId(req.params.id) });
    if (evaluations) {
      res.send(evaluations);
    } else {
      res.status(404).send('Evaluation not found');
    }
  } catch (error) {
    console.error('Failed to fetch evaluations from database', error)
    res.status(500).send('Failed to fetch evaluations from database')
  }
})

app.get('/asignaturas', async (req, res) => {
  try {
    const database = client.db('construccion');
    const collection = database.collection('asignaturas');
    const asignaturas = await collection.find().toArray();
    res.send(asignaturas);
  } catch (error) {
    console.error('Failed to fetch asignaturas from database', error);
    res.status(500).send('Failed to fetch asignaturas from database');
  }
});

app.post('/asignaturasCrear', async (req, res) => {
  try {
    const { title, description, section, profesorId, date, image } = req.body;

    const newAsignatura = {
      title,
      description,
      section,
      image,
      profesorId: new ObjectId(profesorId),
      date,
      members: [],
      sesiones: []
    };

    const database = client.db('construccion');
    const collection = database.collection('asignaturas');
    const result = await collection.insertOne(newAsignatura);

    res.status(201).json({ ...newAsignatura, _id: result.insertedId });
  } catch (error) {
    console.error('Error creating asignatura:', error);
    res.status(500).send('Error creating asignatura');
  }
});

app.post('/asignatura/:id/addStudent', async (req, res) => {
  const { id } = req.params;
  const { studentId } = req.body;

  try {
    const database = client.db('construccion');
    const asignaturaCollection = database.collection('asignaturas');
    const userCollection = database.collection('users');

    // Convertir id y studentId a ObjectId
    const asignaturaId = new ObjectId(id);
    const estudianteId = new ObjectId(studentId);

    const asignatura = await asignaturaCollection.findOne({ _id: asignaturaId });
    if (!asignatura) {
      return res.status(404).send('Asignatura no encontrada');
    }

    const usuario = await userCollection.findOne({ _id: estudianteId });
    if (!usuario) {
      return res.status(400).send('Alumno no encontrado');
    }
    if (usuario.rol === 'profesor') {
      return res.status(400).send('No se puede agregar un profesor');
    }
    if (asignatura.members.some(member => member.equals(estudianteId))) {
      return res.status(400).send('Alumno ya agregado');
    }

    asignatura.members.push(estudianteId);
    await asignaturaCollection.updateOne({ _id: asignaturaId }, { $set: { members: asignatura.members } });

    res.status(200).send(asignatura);
  } catch (error) {
    console.error('Error al agregar alumno:', error);
    res.status(500).send('Error al agregar alumno');
  }
});

app.post('/asignatura/:id/removeStudent', async (req, res) => {
  const { id } = req.params;
  const { studentId } = req.body;

  try {
    const database = client.db('construccion');
    const asignaturaCollection = database.collection('asignaturas');
    const asignaturaId = new ObjectId(id);
    const estudianteId = new ObjectId(studentId);

    const asignatura = await asignaturaCollection.findOne({ _id: asignaturaId });
    if (!asignatura) {
      return res.status(404).send('Asignatura no encontrada');
    }

    asignatura.members = asignatura.members.filter(member => !member.equals(estudianteId));
    await asignaturaCollection.updateOne({ _id: asignaturaId }, { $set: { members: asignatura.members } });

    res.status(200).send(asignatura);
  } catch (error) {
    console.error('Error al eliminar alumno:', error);
    res.status(500).send('Error al eliminar alumno');
  }
});


// Recuperar una asignatura segun id
app.get('/asignatura/:id', async (req, res) => {
  try {
    const database = client.db('construccion');
    const collection = database.collection('asignaturas');
    const consulta = { _id: new ObjectId(req.params.id) };
    const asignatura = await collection.findOne(consulta);
    if (asignatura) {
      res.send(asignatura);
    } else {
      res.status(404).send('Asignatura no encontrada');
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/asignaturas/:alumnoId', async (req, res) => {
  try {
    const alumnoId = new ObjectId(req.params.alumnoId);
    const database = client.db('construccion');
    const collection = database.collection('asignaturas');
    const asignaturas = await collection.find({ members: { $in: [alumnoId] } }).toArray();
    res.send(asignaturas);
  } catch (error) {
    console.error('Failed to fetch asignaturas from database', error);
    res.status(500).send('Failed to fetch asignaturas from database');
  }
});

app.get('/evaluacion/:id', async (req, res) => {
  try {
    const database = client.db('construccion');
    const collection = database.collection('evaluaciones');
    const consulta = { sesionId: new ObjectId(req.params.id) };
    const evaluaciones = await collection.find(consulta).toArray();
    if (evaluaciones) {
      res.send(evaluaciones);
    } else {
      res.status(404).send('Evaluacion no encontrada');
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/faltas/', async (req, res) => {
  try {
    const db = client.db('construccion');
    const userCollection = db.collection('users');
    const faltasCollection = db.collection('faltas');

    const usersData = await userCollection.find({}).toArray();

    const usersWithFaltas = await Promise.all(usersData.map(async (user) => {
      const userID = user._id.toString();
      const userFaltas = await faltasCollection.findOne({ _id: userID });
      return {
        id: userID,
        nombre: user.firstName,
        apellidoPat: user.lastName,
        apellidoMat: user.secondLastName,
        rut: user.rut,
        matricula: user.matricula,
        correo: user.email,
        campus: user.campus,
        faltas: userFaltas ? userFaltas.faltas : 0,
        detalleFaltas: userFaltas ? userFaltas.detalleFaltas : null
      };
    }));
    res.send(usersWithFaltas);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error al recuperar los detalles de los usuarios" });
  }
});

// Recuperar faltas especificas de un usuario
app.get('/faltas/:id', async (req, res) => {
  try {
    const database = client.db('construccion');
    const collection = database.collection('faltas');
    const result = await collection.findOne({ _id: req.params.id });
    res.send(result);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/usuarios', async (req, res) => {
  try {
    const database = client.db('construccion');
    const collection = database.collection('users');
    const usuarios = await collection.find({ role: 'alumno' }).toArray();
    res.send(usuarios);
  } catch (error) {
    console.error('Failed to fetch usuarios from database', error);
    res.status(500).send('Failed to fetch usuarios from database');
  }
});



app.post('/addFaltas/:id', async (req, res) => {
  try {
    const database = client.db('construccion');
    const collection = database.collection('faltas');
    const id = req.params.id;
    const newFalta = req.body;

    const result = await collection.updateOne(
      { _id: id },
      { $push: { detalleFaltas: newFalta }, $inc: { faltas: 1 } }, // Utiliza $push para agregar newFalta al arreglo detalleFaltas
      { upsert: true }
    );

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

// Cambiar estado de alumno (Peligroso / No Peligroso)
app.post('/faltas/:id', async (req, res) => {
  try {
    const database = client.db('construccion')
    const collection = database.collection('faltas')
    const result = await collection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { estado: req.body.estado } }
    )
    res.send(result)
  } catch (error) {
    res.status(500).send(error.message)
  }
})

app.post('/pregunta', async (req, res) => {
  try {
    const database = client.db('construccion')
    const collection = database.collection('asignaturas')
    const pregunta = req.body.texto
    const autor = req.body.autor
    const preguntaId = new ObjectId()

    const result = await collection.updateOne(
      { _id: new ObjectId(req.body.asignaturaId) },
      { $push: { preguntas: { _id: preguntaId, texto: pregunta, autor: autor, respuestas: [] } } }
    )
    res.send(result)
  } catch (error) {
    res.status(500).send(error.message)
  }
})

app.get('/preguntas/:asignaturaId/', async (req, res) => {
  try {
    const database = client.db('construccion')
    const collection = database.collection('asignaturas')
    const asignaturaId = req.params.asignaturaId
    const asignatura = await collection.findOne({ _id: new ObjectId(asignaturaId) })

    if (!asignatura) {
      return res.status(404).json({ message: 'Asignatura no encontrada' })
    }

    const usersCollection = database.collection('users');
    const preguntasConAutorYRespuestas = await Promise.all(asignatura.preguntas.map(async (pregunta) => {
      const autor = await usersCollection.findOne({ _id: new ObjectId(pregunta.autor) });
      const respuestasConAutor = await Promise.all(pregunta.respuestas.map(async (respuesta) => {
        const autorRespuesta = await usersCollection.findOne({ _id: new ObjectId(respuesta.autor) });
        return {
          ...respuesta,
          autor: autorRespuesta ? autorRespuesta.firstName + " " + autorRespuesta.lastName : 'Desconocido',
          autorId: respuesta.autor,
        };
      }));
      return {
        texto: pregunta.texto,
        autor: autor ? autor.firstName + " " + autor.lastName : 'Desconocido',
        autorId: pregunta.autor,
        preguntaId: pregunta._id,
        respuestas: respuestasConAutor,
      };
    }));


    res.send(preguntasConAutorYRespuestas)
  } catch (error) {
    res.status(500).send(error.message)
  }
})

app.delete('/pregunta/:asignaturaId/:preguntaId', async (req, res) => {
  try {
    const database = client.db('construccion')
    const collection = database.collection('asignaturas')
    const asignaturaId = req.params.asignaturaId
    const preguntaId = req.params.preguntaId

    // Eliminar pregunta del arreglo de preguntas de la asignatura
    const result = await collection.updateOne(
      { _id: new ObjectId(asignaturaId) },
      { $pull: { preguntas: { _id: new ObjectId(preguntaId) } } }
    )
    res.send(result)
  } catch (error) {
    res.status(500).send(error.message)
  }
}
)

app.post('/respuesta', async (req, res) => {
  try {
    const database = client.db('construccion')
    const collection = database.collection('asignaturas')
    const respuesta = req.body.texto
    const autor = req.body.autorRespuesta
    const respuestaId = new ObjectId()
    // Agregar respuesta a arreglo de respuestas de la pregunta
    console.log(respuesta)
    console.log(autor)
    console.log(req.body.asignaturaId)
    const result = await collection.updateOne(
      { _id: new ObjectId(req.body.asignaturaId), 'preguntas._id': new ObjectId(req.body.preguntaId) },
      { $push: { 'preguntas.$.respuestas': { _id: respuestaId, texto: respuesta, autor: autor } } }
    )
    res.send()
  } catch (error) {
    res.status(500).send(error.message)
  }
}
)

app.delete('/respuesta/:asignaturaId/:preguntaId/:respuestaId', async (req, res) => {
  try {
    const database = client.db('construccion')
    const collection = database.collection('asignaturas')
    const asignaturaId = req.params.asignaturaId
    const preguntaId = req.params.preguntaId
    const respuestaId = req.params.respuestaId

    // Eliminar respuesta del arreglo de respuestas de la pregunta
    const result = await collection.updateOne(
      { _id: new ObjectId(asignaturaId), 'preguntas._id': new ObjectId(preguntaId) },
      { $pull: { 'preguntas.$.respuestas': { _id: new ObjectId(respuestaId) } } }
    )
    res.send(result)
  } catch (error) {
    res.status(500).send(error.message)
  }
}
)

app.post('/asignatura/:asignaturaId/addSession', async (req, res) => {
  try {
    const database = client.db('construccion');
    const collection = database.collection('asignaturas');
    const asignaturaId = req.params.asignaturaId;
    const sessionId = req.body.sessionId;

    // Encuentra la asignatura por ID
    const asignatura = await collection.findOne({ _id: new ObjectId(asignaturaId) });
    if (!asignatura) {
      return res.status(404).json({ message: 'Asignatura no encontrada' });
    }

    // Agrega la ID de la sesión al arreglo "sesiones" de la asignatura
    const result = await collection.updateOne(
      { _id: new ObjectId(asignaturaId) },
      { $push: { sesiones: new ObjectId(sessionId) } }
    );

    res.sendStatus(200);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).send('Error updating document');
  }
});

//Obtener campus
app.get('/carreras/:campus', async (req, res) => {
  try {
    const database = client.db('construccion');
    const collection = database.collection('carreras');
    const campus = req.params.campus;
    const carrerasData = await collection.findOne({ campus: campus });
    res.send(carrerasData ? carrerasData.carreras : []);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

//Obtener Carreras
app.get('/campus', async (req, res) => {
  try {
    const database = client.db('construccion');
    const collection = database.collection('carreras');
    const campusData = await collection.find({}).project({ campus: 1 }).toArray();
    res.send(campusData);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Obtener lista de sesiones
app.get('/sesion', async (req, res) => {
  try {
    const database = client.db('construccion')
    const collection = database.collection('sesion')
    const sesion = await collection.find({}).toArray()
    res.send(sesion)
  } catch (error) {
    res.status(500).send(error.message)
  }
})

app.get('/sesionAsignatura/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const database = client.db('construccion');
    const asignaturaCollection = database.collection('asignaturas');

    const asignatura = await asignaturaCollection.findOne({ sesiones: new ObjectId(id) });
    if (!asignatura) {
      return res.status(404).send('Asignatura not found');
    }

    res.send(asignatura.title);
  } catch (error) {
    console.error('Failed to fetch asignatura', error);
    res.status(500).send('Failed to fetch asignatura');
  }
});

app.post('/asignaturas', async (req, res) => {
  try {
    const { title, description, section, profesorId, date } = req.body;
    const file = req.file;

    const newAsignatura = {
      title,
      description,
      section,
      image: '',
      profesorId: new ObjectId(profesorId),
      date,
      members: [],
      sesiones: [],
      preguntas: []
    };

    const collection = db.collection('asignaturas');
    const result = await collection.insertOne(newAsignatura);

    if (file && result.insertedId) {
      const uniqueId = uuidv4();
      const storageReference = storageRef(storage, `asignaturasFotos/${uniqueId}`);

      const snapshot = await uploadBytes(storageReference, file.buffer, { contentType: file.mimetype });
      const imageUrl = await getDownloadURL(snapshot.ref);

      await collection.updateOne(
        { _id: result.insertedId },
        { $set: { image: imageUrl } }
      );

      res.status(201).json(result.ops[0]);
    } else {
      res.status(201).json(result.ops[0]);
    }
  } catch (error) {
    console.error('Error creating asignatura:', error);
    res.status(500).send('Error creating asignatura');
  }
});

// Obtener una sesión específica por ID
const getParticipantDetails = async (participantIds, usersCollection) => {
  console.log('Original participant IDs:', participantIds);

  // Convertimos los ids a ObjectId solo si no son ya ObjectId
  const objectIds = participantIds.map(id => {
    return typeof id === 'string' ? new ObjectId(id) : id;
  });

  console.log('Converted Object IDs:', objectIds);

  // Realizamos la consulta y agregamos depuración
  const participants = await usersCollection.find({ _id: { $in: objectIds } }).toArray();
  console.log('Fetched participants:', participants);
  return participants;
}

app.get('/sessions/:id', async (req, res) => {
  try {
    const database = client.db('construccion');
    const sessionCollection = database.collection('sesion');
    const usersCollection = database.collection('users');

    const consulta = { _id: new ObjectId(req.params.id) };
    const session = await sessionCollection.findOne(consulta);

    if (!session) {
      return res.status(404).send('Sesión no encontrada');
    }

    // Obtener la información completa de los participantes
    const participantes = await getParticipantDetails(session.participantes, usersCollection);

    session.participantes = participantes;

    res.json(session);
  } catch (error) {
    console.error('Error fetching session data:', error);
    res.status(500).send(error.message);
  }
});

app.post('/guardarEvaluacion', async (req, res) => {
  const { evaluacion, sesionId } = req.body;

  try {
    const database = client.db('construccion');
    const collection = database.collection('evaluaciones');

    // Verifica que el sesionId es un ObjectId válido
    let objectId;
    try {
      objectId = new ObjectId(sesionId);
    } catch (error) {
      return res.status(400).json({ success: false, message: 'Invalid session ID format', error: error.message });
    }

    // Inserta la evaluación en la colección de evaluaciones
    const result = await collection.insertOne({
      ...evaluacion,
      sesionId: objectId
    });

    res.status(200).json({ success: true, result });
  } catch (error) {
    console.error('Error al guardar la evaluación:', error);
    res.status(500).json({ success: false, message: 'Error al guardar la evaluación', error: error.message });
  }
});



// Se actualiza la lista de participantes de una sesión
app.put('/sesion/:id', async (req, res) => {
  try {
    const database = client.db('construccion')
    const collection = database.collection('sesion')
    const consulta = { _id: new ObjectId(req.params.id) }
    const nuevosParticipantes = req.body.participantes
    const result = await collection.updateOne(consulta, {
      $set: { participantes: nuevosParticipantes }
    })

    if (result.modifiedCount === 1) {
      res.send(result)
    } else {
      res.status(404).send('Sesión no encontrada')
    }
  } catch (error) {
    res.status(500).send(error.message)
  }
})

/* FUNCION DE LOGIN DE GRUPO JOAQUIN*/
app.post('/login', async (req, res) => {
  try {
    const database = client.db('construccion')
    const User = database.collection('users')
    const user = await User.findOne({ email: req.body.email })
    const historialLogin = database.collection('historialLogin') //nueva coleccion para almacenar el historial del login en la pagina

    if (!user) {
      return res.json({ success: false })
    }

    if (req.body.password !== user.password) {
      return res.json({ success: false })
    }

    // Excluir la contraseña de la respuesta
    const { password, ...userWithoutPassword } = user
    // Guardar el usuario en el historial de login
    await historialLogin.insertOne({
      IdUsuario: user._id,
      nombre: user.username,
      email: user.email,
      tiempoLogin: new Date()
    })

    // Mostrar historial de login
    const historial = await historialLogin.find().toArray()
    //console.log('Historial de login:', historial)

    res.json({ success: true, user: userWithoutPassword })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

app.post('/register', async (req, res) => {
  const {
    email,
    username,
    password,
    confirmPassword,
    firstName,
    lastName,
    secondLastName,
    campus,
    major,
    role,
    rut,
    matricula
  } = req.body
  const verificationToken = jwt.sign(
    {
      email,
      username,
      password,
      confirmPassword,
      firstName,
      lastName,
      secondLastName,
      campus,
      major,
      rut,
      role,
      matricula
    },
    SECRET_KEY,
    { expiresIn: '24h' }
  )

  let transporter = nodemailer.createTransport({
    service: 'outlook',
    auth: {
      user: 'pruebas.construccion2024@outlook.com',
      pass: 'RkUFFzM1LUTk'
    }
  })

  let mailOptions = {
    from: 'pruebas.construccion2024@outlook.com',
    to: email,
    subject: 'Verificación de Correo Electrónico en Cheat Detector',
    html: `<p>Haz clic en el siguiente enlace para verificar tu correo electrónico: <a href="http://localhost:8080/verify?token=${verificationToken}">Verificar Correo</a></p>`
  }

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return res.status(500).send('Error al enviar el correo de verificación')
    } else {
      return res.status(200).json({ success: true, message: 'Correo de verificación enviado' })
    }
  })
})

app.post('/resetPassword', async (req, res) => {
  const { email } = req.body;

  const database = client.db('construccion');
  const User = database.collection('users');
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).send('Usuario no encontrado.');
  }

  const resetCode = Math.random().toString(36).substring(2, 15);

  await User.updateOne({ email }, { $set: { resetCode: resetCode } });

  let transporter = nodemailer.createTransport({
    service: 'outlook',
    auth: {
      user: 'pruebas.construccion2024@outlook.com',
      pass: 'RkUFFzM1LUTk'
    }
  });

  let mailOptions = {
    from: 'pruebas.construccion2024@outlook.com',
    to: email,
    subject: 'Código de reseteo de contraseña',
    text: `Tu código de reseteo es: ${resetCode}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      return res.status(500).send('Error al enviar el correo.');
    } else {
      console.log('Email enviado: ' + info.response);
      return res.send('Correo de reseteo enviado.');
    }
  });
});

app.post('/verifyResetCode', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ success: false, message: 'Email y código son requeridos.' });
  }
  try {
    const database = client.db('construccion');
    const User = database.collection('users');
    const user = await User.findOne({ email: email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    if (user.resetCode === code) {
      res.json({ success: true, message: 'Código verificado correctamente.', email: email });
      await User.updateOne({ email: email }, { $set: { resetCode: '' } });
    } else {
      res.status(400).json({ success: false, message: 'Código inválido o expirado.' });
    }
  } catch (error) {
    console.error('Error al verificar el código de restablecimiento:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
});

app.post('/loginInsta', async (req, res) => {
  const correo = req.body.email;
  try {
    const database = client.db('construccion');
    const User = database.collection('users');
    const user = await User.findOne({ email: correo });
    if (user) {
      const password = user.password;
      const email2 = user.email;
      res.json({ success: true, password, email2 });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.post('/update-password', async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const userId = decoded.userId;
    await updateUserPassword(userId, newPassword);
    res.send('Contraseña actualizada con éxito.');
  } catch (error) {
    res.status(400).send('Error al actualizar la contraseña.');
  }
});

app.get('/verify', async (req, res) => {
  const { token } = req.query
  try {
    const decoded = jwt.verify(token, SECRET_KEY)
    const rol = 'alumno'
    const {
      email,
      username,
      password,
      confirmPassword,
      firstName,
      lastName,
      secondLastName,
      campus,
      major,
      role,
      rut,
      matricula
    } = decoded

    const emailDomain = email.split('@')[1];
    if (emailDomain === 'utalca.cl') {
      rol = 'profesor';
    }

    const database = client.db('construccion')
    const User = database.collection('users')

    const verificacionUser = await User.findOne({ email })

    if (verificacionUser) {
      res.redirect('http://localhost:5173/')
    } else {
      await User.insertOne({
        email: email,
        username: username,
        password: password,
        confirmPassword: confirmPassword,
        firstName: firstName,
        lastName: lastName,
        secondLastName: secondLastName,
        rut: rut,
        matricula: matricula,
        campus: campus,
        role: rol,
        major: major
      })
    }

    res.redirect('http://localhost:5173/')
  } catch (error) {
    console.error('Error al verificar el token:', error)
    return res.status(500).send('Error al verificar el correo electrónico')
  }
})

app.post('/checkEmail', async (req, res) => {
  try {
    const database = client.db('construccion')
    const User = database.collection('users')
    const user = await User.findOne({ email: req.body.email })

    if (user) {
      res.json({ exists: true })
    } else {
      res.json({ exists: false })
    }
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error del servidor' })
  }
})
//actualizar ciertos datos del perfil
app.post('/verify_password', async (req, res) => {
  const database = client.db('construccion')
  const User = database.collection('users')
  try {
    const email = { email: req.body.email }
    const val_password = { val_password: req.body.val_password }

    // Busca al usuario en la base de datos
    const user = await User.findOne({ email })

    if (!user) {
      return res.status(400).json({ passwordCorrect: false })
    }
    const passwordCorrect = await bcrypt.compare(val_password, user.password)
    res.json(passwordCorrect)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error del servidor' })
  }
})
app.post('/edit_username', async (req, res) => {
  try {
    const database = client.db('construccion')
    const User = database.collection('users')
    const filter = { email: req.body.email }
    const update = { username: req.body.new_username }
    if (update != '') {
      await User.updateOne(filter, { $set: update })
    }
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error del servidor' })
  }
})
app.post('/edit_password', async (req, res) => {
  try {
    const database = client.db('construccion')
    const User = database.collection('users')
    const filter = { email: req.body.email }
    const update1 = { password: req.body.new_password, confirmPassword: req.body.new_password }
    if (update1 != '' || update1 != ' ') {
      await User.updateOne(filter, { $set: update1 })
    }
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error del servidor' })
  }
})
app.post('/anadir_Usuario', async (req, res) => {

  try {
    const database = client.db('construccion')
    const Sesion = database.collection('sesion')
    const nuevos_usuarios = req.body.users;
    const sesion_id = req.body.sesion_id;

    const result = await Sesion.updateOne({ _id: new ObjectId(sesion_id) }, { $push: { participantes: { $each: nuevos_usuarios } } });

    if (result.matchedCount === 0) {
      res.status(404).send('No se encontró la sesión con el id proporcionado');
    } else if (result.modifiedCount === 0) {
      res.status(400).send('No se pudo actualizar la sesión');
    } else {
      res.status(200).send('Usuarios añadidos exitosamente');
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Hubo un error al añadir los usuarios');
  }
});
app.get('/obtenerMiembrosAsignatura', async (req, res) => {
  try {
    const { asignaturaId } = req.query;
    //console.log("asignaturaId recibido:", asignaturaId);

    const database = client.db('construccion');
    const collection = database.collection('asignaturas');
    const asignatura = await collection.findOne({ _id: new ObjectId(asignaturaId) });

    if (!asignatura) {
      return res.send([]);
    } else {
      const miembros = asignatura.members;
      res.send(miembros);
    }
    //console.log("Miembros encontrados:", miembros);

  } catch (error) {
    console.error(error);
    res.status(500).send({ error: 'Error interno del servidor' });
  }
});
app.post('/anadir_app', async (req, res) => {
  try {
    const database = client.db('construccion')
    const coleccion = database.collection('peligroSesion');

    const nombreApp = req.body.nombreApp;
    const LinkApp = req.body.LinkApp;
    const nivelPeligro = req.body.nivelPeligro;
    const asignatura = req.body.asignatura;
    //console.log(nombreApp + " ---- " + LinkApp + " ------- " + nivelPeligro + " ---- " + asignatura)
    const appExistente = await coleccion.findOne({
      $or: [
        { nombre: nombreApp, asignatura: asignatura },
        { link: LinkApp, asignatura: asignatura }
      ]
    });

    if (appExistente) {
      res.status(409).send({ error: 'La aplicación con la misma asignatura ya está ingresada' });
    } else {
      await coleccion.insertOne({ nombre: nombreApp, link: LinkApp, peligro: nivelPeligro, asignatura: asignatura });
      res.status(201).send({ message: 'Aplicación añadida exitosamente' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Hubo un error al añadir los usuarios');
  }
});
app.get('/appPeligrosas/:asignaturas', async (req, res) => {
  try {
    const database = client.db('construccion');
    const collection = database.collection('peligroSesion');
    const asignatura = req.params.asignaturas;
    //console.log("Asignatura buscada:", asignatura);
    const documentos = await collection.find({ asignatura: asignatura }).toArray();

    res.status(200).json(documentos);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
})


//--------------------
// Obtener sesion especifica
app.get('/sesion/:id', async (req, res) => {
  try {
    const database = client.db('construccion')
    const collection = database.collection('sesion')
    const consulta = { _id: new ObjectId(req.params.id) }
    const result = await collection.findOne(consulta)
    res.send(result)
  } catch (error) {
    res.status(500).send(error.message)
  }
})

app.get('/user/:id', async (req, res) => {
  try {
    const database = client.db('construccion');
    const collection = database.collection('users');
    const consulta = { _id: new ObjectId(req.params.id) };
    const result = await collection.findOne(consulta);
    if (result) {
      res.send(result);
    } else {
      res.status(404).send('Usuario no encontrado');
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Ruta para actualizar un usuario por ID
app.post('/user/:id', async (req, res) => {
  try {
    const database = client.db('construccion');
    const collection = database.collection('users');
    const userId = new ObjectId(req.params.id);
    const updateData = req.body;

    // Obtener los datos actuales del usuario
    const user = await collection.findOne({ _id: userId });
    if (!user) {
      return res.status(404).send('Usuario no encontrado');
    }

    // Combinar los datos antiguos con los nuevos
    const updatedUser = { ...user, ...updateData };

    // Actualizar el usuario en la base de datos
    const result = await collection.updateOne(
      { _id: userId },
      { $set: updatedUser }
    );

    if (result.modifiedCount === 1) {
      res.status(200).send('Usuario actualizado correctamente');
    } else {
      res.status(404).send('Usuario no encontrado');
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Enviar una alerta a un usuario
// Se guarda un mensaje de alerta en un array para el usuario
// Para utilizar el mensaje de alerta en algun componente es necesario usar el
// metodo GET /user/:id/alertas abajo para obtener los mensajes
app.post('/user/:id/alerta', async (req, res) => {
  try {
    const database = client.db('construccion')
    const collection = database.collection('users')
    const consulta = { _id: new ObjectId(req.params.id) }
    const mensaje = req.body.mensaje
    const result = await collection.updateOne(consulta, { $push: { alertas: mensaje } })

    if (result.modifiedCount === 1) {
      res.send(result)
    } else {
      res.status(404).send('Usuario no encontrado')
    }
  } catch (error) {
    res.status(500).send(error.message)
  }
})

// Usa este método para obtener los mensajes de alerta de un usuario
app.get('/user/:id/alertas', async (req, res) => {
  try {
    const database = client.db('construccion')
    const collection = database.collection('users')
    const consulta = { _id: new ObjectId(req.params.id) }
    const usuario = await collection.findOne(consulta)

    if (usuario) {
      res.send(usuario.alertas)
    } else {
      res.status(404).send('Usuario no encontrado')
    }
  } catch (error) {
    res.status(500).send(error.message)
  }
})

// Para mostrar los mensajes de alerta en algún componente puedes usar la siguiente función
// USAR SOLO EN EL FRONTEND (NO AQUI)
/*
  const obtenerAlertas = async () => {
    try {
        let respuesta = await fetch(`http://localhost:8080/user/${idUsuario}/alertas`)
        let alertas = await respuesta.json()
  
        // Muestra las alertas al usuario
        alertas.forEach(alerta => {
            alert(alerta)
        })
    }
    catch (error) {
        console.error('Error al obtener las alertas:', error)
    }
  }  
  // Se llama a obtenerAlertas cada 5 segundos
  setInterval(obtenerAlertas, 5000)
  */


// crear una nueva sesión
app.post('/sesion', async (req, res) => {
  try {
    const database = client.db('construccion')
    const collection = database.collection('sesion')
    const newSession = {
      nombre: req.body.nombre,
      descripcion: req.body.descripcion,
      asignatura: req.body.asignatura,
      creador: req.body.creador,
      participantes: [],
      banlist: [],
      cancelada: false,
      config: "667a05efbb7705789ce7d147", //configuración default
    }
    //console.log("enviando", newSession.nombre, newSession.descripcion)
    const result = await collection.insertOne(newSession)
    res.status(200).json({ _id: result.insertedId });
  } catch (error) {
    console.error('Error inserting document:', error)
    res.status(500).send('Error inserting document')
  }
})

// Banear o expulsar a un alumno de una sesión

app.post('/banearExpulsar/:id', async (req, res) => {
  try {
    const database = client.db('construccion');
    const collection = database.collection('sesion');
    const sessionId = req.params.id;
    const bannedEmail = req.body.email;
    const userId = req.body.userId;
    const banear = req.body.banear;
    const razonban = req.body.razonBan;

    // Revisa si la sesión existe
    const session = await collection.findOne({ _id: new ObjectId(sessionId) });

    if (!session) {
      return res.status(404).json({ message: 'Sesión no encontrada' });
    }

    let resultMessage = '';

    if (banear) {
      // Actualiza la lista de correos baneados de la sesión
      const result = await collection.updateOne(
        { _id: new ObjectId(sessionId) },
        { $addToSet: { banlist: bannedEmail } }
      );

      const result2 = await collection.updateOne(
        { _id: new ObjectId(sessionId) },
        { $addToSet: { razonBAN: razonban } }
      );

      if (result.matchedCount == 1 && result2.matchedCount == 1) {
        resultMessage = 'Alumno baneado de la sesión';
      }
    }

    else {
      const removeResult = await collection.updateOne(
        { _id: new ObjectId(sessionId) },
        { $pull: { participantes: userId } }
      );
      if (removeResult.modifiedCount > 0) {
        if (resultMessage) {
          resultMessage += ' y expulsado de la lista de participantes.';
        } else {
          resultMessage = 'Alumno expulsado de la lista de participantes.';
        }
      }
      else {
        if (!resultMessage) {
          return res.status(404).json({ success: false, message: 'Problema encontrado al intentar banear al alumno' });
        }
      }
    }

    res.json({ success: true, message: resultMessage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/desbanear/:id', async (req, res) => {
  try {
    const database = client.db('construccion');
    const collection = database.collection('sesion');
    const sessionId = req.params.id;
    const unbannedEmail = req.body.email;

    // Revisa si la sesión existe
    const session = await collection.findOne({ _id: new ObjectId(sessionId) });

    if (!session) {
      return res.status(404).json({ message: 'Sesión no encontrada' });
    }

    let resultMessage = '';
    const addResult = await collection.updateOne(
      { _id: new ObjectId(sessionId) },
      { $pull: { banlist: unbannedEmail } }
    );

    if (addResult.modifiedCount > 0) {
      if (resultMessage) {
        resultMessage += ' y agregado a la lista de participantes.';
      } else {
        resultMessage = 'Alumno expulsado de la lista de baneados.';
      }
    }
    else {
      if (!resultMessage) {
        return res.status(404).json({ success: false, message: 'Problema encontrado al intentar banear al alumno' });
      }
    }

    res.json({ success: true, message: resultMessage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/bannedusers/:id', async (req, res) => {
  try {
    const database = client.db('construccion');
    const sessionCollection = database.collection('sesion');
    const sessionId = { _id: new ObjectId(req.params.id) };
    const session = await sessionCollection.findOne(sessionId);

    if (!session) {
      return res.status(404).send('Sesión no encontrada');
    }
    const banlist = session.banlist || [];
    // Obtener la información completa de los participantes
    //const participantes = await getParticipantDetails(session.participantes, usersCollection);

    //session.participantes = participantes;

    res.json(banlist);
  } catch (error) {
    console.error('Error fetching session data:', error);
    res.status(500).send(error.message);
  }
});

app.post('/agregarParticipante', async (req, res) => {
  try {
    //Implementar lógica para agregar participante a sesion
    //se asume que se enviaran como parametros el id de la sesion y el id del participante

    //cambiar estos por req.body.idSesion y req.body.idParticipante
    let idSesion = '665d1794a22b8d44afad0793'
    let idParticipante = '665cfd84b637ff59e562b66d'

    //obtenemos la sesion
    const database = client.db('construccion')
    const collection = database.collection('sesion')
    const consulta = { _id: new ObjectId(idSesion) }
    const result = await collection.findOne(consulta)

    //Si el usuario fue baneado de la sesion no lo agregamos
    if (result) {
      // Verificar si el participante está en la banlist
      const participanteBaneado = result.banlist.some((element) => idParticipante === element)
      if (participanteBaneado) {
        return res.status(403).send('Participante baneado no se puede agregar')
      }
    }

    //Continuar con la lógica para agregar participante a sesion

    res.sendStatus(200)
  } catch (error) {
    console.error(error)
    res.status(500).send(error.message)
  }
})


// HU-8 BlackList
app.get('/sesion/:idSesion/blacklist', async (req, res) => {
  try {
    const database = client.db('construccion');
    const collection = database.collection('sesion');
    const idSesion = new ObjectId(req.params.idSesion);

    // Obtener la sesión y su banlist
    const sesion = await collection.findOne({ _id: idSesion }, { projection: { banlist: 1 } });

    if (sesion) {
      res.send(sesion.banlist);
    } else {
      res.status(404).send('Sesión no encontrada');
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

////////Funciones asociadas a los mensajes

// Crear un nuevo mensaje
app.post('/message', async (req, res) => {
  try {
    const database = client.db('construccion')
    const collection = database.collection('mensajes')

    //traemos todas las sesiones
    const collSesiones = database.collection('sesion')
    const sesiones = await collSesiones.find({}).toArray()

    //traemos la información de la sesion correspondiente
    let sesionCorrecta = sesiones.filter(sesion => sesion._id == req.body.sesion)

    // traemos los usuarios
    const collUsers = database.collection('users')
    const users = await collUsers.find({}).toArray()

    let remitentenombre = users.filter(user => user._id == req.body.remitente)
    let destinatarionombre = users.filter(user => user._id == req.body.destinatario)

    let asignatura = [{ title: 'default' }]
    // traemos las asignaturas
    if (!sesionCorrecta.asignatura) {
      const collAsignaturas = database.collection('asignaturas')
      const asignaturas = await collAsignaturas.find({}).toArray()
      asignatura = asignaturas.filter(assig => assig._id == sesionCorrecta[0].asignatura)
    }

    const newMessage = {
      destinatario: req.body.destinatario,
      mensaje: req.body.mensaje,
      remitente: req.body.remitente,
      visto: false,
      alerta: '',
      //guardamos el nombre de la sesion
      sesion: sesionCorrecta[0].nombre,
      fecha: new Date(),
      asignatura: asignatura[0].title,
      remitenteNombre: remitentenombre[0].firstName + ' ' + remitentenombre[0].lastName,
      destinatarionombre: destinatarionombre[0].firstName + ' ' + destinatarionombre[0].lastName
    }
    const result = await collection.insertOne(newMessage)
    res.sendStatus(200)
  } catch (error) {
    console.error('Error inserting document:', error)
    res.status(500).send('Error inserting document')
  }
})

//traer todos los mensajes (No muy util)
app.get('/message/', async (req, res) => {
  try {
    const database = client.db('construccion')
    const collection = database.collection('mensajes')
    // Lista de mensajes completa
    const result = await collection.find({}).toArray()
    res.status(200).send(result)

  } catch (error) {
    res.status(500).send(error.message)
  }
})

// traer los mensajes recibidos por un alumno especifico
app.get('/message/:id', async (req, res) => {
  try {
    const database = client.db('construccion')
    const collection = database.collection('mensajes')
    // Lista de mensajes completa
    const result = await collection.find({}).toArray()
    let mensajesEspecificos = []
    // revisamos todos los mensajes y guardamos aquellos que tengan remitente igual al id

    if (!result) {
      res.status(404).send('user not found')
    }

    result.forEach(element => {
      if (element.destinatario == req.params.id) {
        mensajesEspecificos.push(element)
      }
    });

    res.status(200).send(mensajesEspecificos)


  } catch (error) {
    res.status(500).send(error.message)
  }
})

// traer los mensajes enviados por alguien especifico 
app.get('/sendmessage/:id', async (req, res) => {
  try {
    const database = client.db('construccion')
    const collection = database.collection('mensajes')
    // Lista de mensajes completa
    const result = await collection.find({}).toArray()
    let mensajesEspecificos = []
    // revisamos todos los mensajes y guardamos aquellos que tengan remitente igual al id

    if (!result) {
      res.status(404).send('user not found')
    }

    result.forEach(element => {
      if (element.remitente == req.params.id) {
        mensajesEspecificos.push(element)
      }
    });

    res.status(200).send(mensajesEspecificos)


  } catch (error) {
    res.status(500).send(error.message)
  }
})

// Actualizar estado de visto de un mensaje
app.put('/message/:id', async (req, res) => {
  try {
    const database = client.db('construccion')
    const collection = database.collection('mensajes')
    const consulta = { _id: new ObjectId(req.params.id) }
    const result = await collection.updateOne(consulta, {
      $set: { visto: true }
    })

    if (result.modifiedCount === 1) {
      res.send(result)
    } else {
      res.status(404).send('Mensaje no encontrado')
    }
  } catch (error) {
    res.status(500).send(error.message)
  }
})

// Enviar email (página contacto)
app.post('/send-email', async (req, res) => {
  let { fullName, email, mobile, msg } = req.body;

  let transporter = nodemailer.createTransport({
    service: 'outlook',
    auth: {
      user: 'pruebas.construccion2024@outlook.com',
      pass: 'RkUFFzM1LUTk'
    }
  });

  let mailOptions = {
    from: 'pruebas.construccion2024@outlook.com',
    to: 'pruebas.construccion2024@outlook.com',
    subject: `[Contacto Cheat Detector] Mensaje de ${fullName}`,
    text: `Nombre: ${fullName}\nEmail: ${email}\nTeléfono: ${mobile}\nMensaje: ${msg}`
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).send('Correo electrónico enviado correctamente');
  } catch (error) {
    console.error('Hubo un error al enviar el correo electrónico', error);
    res.status(500).send('Hubo un error al enviar el correo electrónico');
  }
});

app.post('/emailContactoAlumno', async (req, res) => {
  try {
    const { to, subject, body } = req.body;

    let transporter = nodemailer.createTransport({
      service: 'outlook',
      auth: {
        user: 'pruebas.construccion2024@outlook.com',
        pass: 'RkUFFzM1LUTk'
      }
    });

    const mailOptions = {
      from: 'pruebas.construccion2024@outlook.com',
      to: 'pruebas.construccion2024@outlook.com', // Cambiar por el email del alumno
      subject: subject,
      text: body
    };

    const result = await transporter.sendMail(mailOptions);
    res.send({ message: 'Correo enviado correctamente', result: result });
  } catch (error) {
    console.error('Error al enviar correo electrónico:', error);
    res.status(500).send({ message: 'Error al enviar correo electrónico', error: error });
  }
});

// Enviar email (página contacto alumno)
app.post('/email-alumno', async (req, res) => {
  let { profesor, email, msg, correoProfesor, alumno } = req.body;

  let transporter = nodemailer.createTransport({
    service: 'outlook',
    auth: {
      user: 'pruebas.construccion2024@outlook.com',
      pass: 'RkUFFzM1LUTk'
    }
  });

  let mailOptions = {
    from: 'pruebas.construccion2024@outlook.com',
    to: email,
    subject: `[Cheat Detector] Mensaje de profesor ${profesor}`,
    text: `Mensaje enviado a: ${email}\nEstimado ${alumno}:\n${msg}\nAtentamente, profesor ${profesor}\n ${correoProfesor}\n`
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).send('Correo electrónico enviado correctamente');
  } catch (error) {
    console.error('Hubo un error al enviar el correo electrónico', error);
    res.status(500).send('Hubo un error al enviar el correo electrónico');
  }
});
// Enviar email (contactar Profesor)
app.post('/email-profesor', async (req, res) => {
  let { profesor, email, mensaje, correoAlumno, alumno } = req.body;

  let transporter = nodemailer.createTransport({
    service: 'outlook',
    auth: {
      user: 'pruebas.construccion2024@outlook.com',
      pass: 'RkUFFzM1LUTk'
    }
  });

  let mailOptions = {
    from: 'pruebas.construccion2024@outlook.com',
    to: email,
    subject: `[Cheat Detector] Mensaje de alumno ${alumno}`,
    text: `Mensaje enviado a: ${email}\nEstimado profesor${profesor}:\n${mensaje}\nAtentamente, ${alumno}\n ${correoAlumno}\n`
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).send('Correo electrónico enviado correctamente');
  } catch (error) {
    console.error('Hubo un error al enviar el correo electrónico', error);
    res.status(500).send('Hubo un error al enviar el correo electrónico');
  }
});
/* revisiar esta funcion de grupo joaquin */

// Guarda/actualiza los procesos en la base de datos

app.post('/checkTabs', async (req, res) => {
  const { procesos, userId, sessionId } = req.body;
  const database = client.db('construccion');
  const collection = database.collection('procesos');
  try {
    // Asegurarse de que procesos sea un array
    const nuevosProcesoArray = Array.isArray(procesos) ? procesos : [procesos];

    // Primero, obtener el documento actual
    const currentDoc = await collection.findOne({ userId, sessionId });

    let procesosActualizados = [];
    let cambios = {
      agregados: [],
      existentes: []
    };

    if (currentDoc && Array.isArray(currentDoc.procesos)) {
      // Combinar procesos existentes con nuevos
      procesosActualizados = [...new Set([...currentDoc.procesos, ...nuevosProcesoArray])];
      cambios.agregados = nuevosProcesoArray.filter(p => !currentDoc.procesos.includes(p));
      cambios.existentes = nuevosProcesoArray.filter(p => currentDoc.procesos.includes(p));
    } else {
      // Si no hay documento previo o procesos no es un array, todos los procesos son nuevos
      procesosActualizados = nuevosProcesoArray;
      cambios.agregados = nuevosProcesoArray;
    }

    // Actualizar o insertar el documento
    const result = await collection.findOneAndUpdate(
      {
        userId: userId,
        sessionId: sessionId
      },
      {
        $set: {
          userId: userId,
          sessionId: sessionId,
          procesos: procesosActualizados
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );

  } catch (err) {
    console.error('Error al interactuar con la base de datos:', err);
    res.status(500).send('Error interno del servidor al interactuar con la base de datos');
  }
});

app.get('/obtenerProcesos/:userId', async (req, res) => {
  const userId = req.params.userId;
  const database = client.db('construccion');
  const collection = database.collection('procesos');

  try {
    const result = await collection.findOne({ userId });
    if (result) {
      console.log('Procesos obtenidos:', result.procesos);
      res.json(result.procesos);
    } else {
      console.log('No se encontraron procesos para el usuario en la sesión');
      res.json([]);
    }
  } catch (err) {
    console.error('Error al obtener los procesos:', err);
    res.status(500).send('Error al obtener los procesos');
  }
});
app.post('/processTabs', (req, res) => {
  const { userId, urls, timestamp } = req.body;
  console.log('Received data:', { userId, urls, timestamp });

  // Guardar datos en MongoDB
  const database = client.db('construccion');
  const collection = database.collection('Pestanas'); // Nombre de la colección en MongoDB

  // Actualizar documento con userId, URLs y timestamp en la colección
  collection.updateOne(
    { userId: userId }, // Criterio de búsqueda: documento con el mismo userId
    { $set: { urls: urls, timestamp: timestamp } }, // Campos a actualizar
    { upsert: true } // Opción para insertar un nuevo documento si no existe ninguno que coincida
  )
  .then(result => {
    if (result.matchedCount === 0) {
      console.log('No se encontró el documento con el userId especificado, se creó uno nuevo.');
    } else {
      console.log('Documento con userId actualizado en MongoDB:', result);
    }
    res.send('Datos recibidos y actualizados en MongoDB');
  })
  .catch(err => {
    console.error('Error al actualizar datos en MongoDB:', err);
    res.status(500).send('Error interno del servidor al actualizar datos en MongoDB');
  });
});

app.get('/obtenerUltimaEntrada/:userId', (req, res) => {
  const userId = req.params.userId;

  // Consultar MongoDB para obtener la última entrada para este userId
  const database = client.db('construccion');
  const collection = database.collection('Pestanas'); // Nombre de la colección en MongoDB
  console.log('Consultando última entrada para userId:', userId);

  collection.find({ userId }).sort({ timestamp: -1 }).limit(1).toArray()
    .then(entries => {
      if (entries.length > 0) {
        const lastEntry = entries[0];
        res.json(lastEntry); // Enviar la última entrada encontrada como respuesta
      } else {
        res.status(404).send('No se encontraron entradas para este usuario');
      }
    })
    .catch(err => {
      console.error('Error al consultar MongoDB:', err);
      res.status(500).send('Error interno del servidor al consultar MongoDB');
    });
});


app.post('/checkTabs1', (req, res) => {
  const { userId, urls } = req.body;
  console.log('Checking data:', { userId, urls });

  const database = client.db('construccion');
  const collection = database.collection('Pestanas');

  // Buscar si ya existe algún documento con las mismas userId y URLs en la colección
  collection.findOne({ userId, urls })
    .then(doc => {
      if (doc) {
        // Si se encuentra un documento, significa que las URLs ya existen para ese usuario
        console.log('Las URLs ya existen en la base de datos para este usuario:', doc);
        res.json({ exists: true }); // Responder que los datos ya existen
      } else {
        // Si no se encuentra ningún documento, las URLs no existen aún para ese usuario
        console.log('Las URLs no existen en la base de datos para este usuario, se pueden procesar.');
        res.json({ exists: false }); // Responder que los datos no existen y pueden ser procesados
      }
    })
    .catch(err => {
      console.error('Error al buscar en la base de datos:', err);
      res.status(500).send('Error interno del servidor al buscar en la base de datos');
    });
});

app.get('/getTabs/:userId', (req, res) => {
  try {
    const userId = req.params.userId; // Obtener el userId de los parámetros de la URL

    const database = client.db('construccion');
    const collection = database.collection('Pestanas');

    // Buscar documentos con el userId específico en la colección
    collection.find({ userId }).toArray()
      .then(docs => {
        if (docs.length === 0) {
          // Si no se encuentra ningún documento para el userId dado
          res.status(404).send('No se encontraron pestañas para el usuario.');
        } else {
          // Si se encuentran documentos, enviar las URLs encontradas
          const urls = docs.map(doc => doc.urls);
          res.json(urls);
        }
      })
      .catch(err => {
        console.error('Error al buscar en la base de datos:', err);
        res.status(500).send('Error interno del servidor al buscar en la base de datos');
      });
  } catch (error) {
    res.status(500).send(error.message);
  }
});


app.get('/configs', async (req, res) => {
  try {
    const database = client.db('construccion')
    const collection = database.collection('configuraciones')
    const configs = await collection.find({}).toArray()
    res.send(configs)
  } catch (error) {
    res.status(500).send(error.message)
  }
});

app.get('/config/:id', async (req, res) => {
  try {
    const database = client.db('construccion')
    const collection = database.collection('configuraciones')
    const config = await collection.findOne({ _id: req.params.id });
    res.send(config)
    console.log(config)
  } catch (error) {
    res.status(500).send(error.message)
  }
});

app.get('/userConfigs/:id', async (req, res) => {
  try {
    const database = client.db('construccion');
    const collection = database.collection('users');
    const result = await collection.findOne({ _id: new ObjectId(req.params.id) });
    if (result && result.configs) {
      res.send(result.configs);
    } else {
      res.status(404).send('No se encontraron configuraciones para el usuario especificado.');
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/configuracion/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amarillo, rojo, verde } = req.body;

    if (!Array.isArray(amarillo) || !Array.isArray(rojo) || !Array.isArray(verde)) {
      return res.status(400).send('Las listas amarillo, rojo y verde deben ser arreglos de strings.');
    }

    const database = client.db('construccion');
    const collection = database.collection('configuraciones');

    // Actualizar el objeto de configuración con el _id proporcionado
    const resultado = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { amarillo, rojo, verde } }
    );

    if (resultado.matchedCount === 0) {
      return res.status(404).send('Configuración no encontrada.');
    }

    res.send('Configuración actualizada con éxito.');
  } catch (error) {
    console.error('Error al actualizar la configuración:', error);
    res.status(500).send('Error al actualizar la configuración');
  }
});

app.put('/cancelarSesion/:id', async (req, res) => {
  try {
    const database = client.db('construccion')
    const collection = database.collection('sesion')
    const consulta = { _id: new ObjectId(req.params.id) }
    const result = await collection.updateOne(consulta, {
      $set: { cancelada: true }
    })
    if (result.modifiedCount === 1) {
      res.send(result)
    } else {
      res.status(404).send('Sesion no encontrada')
    }
  } catch (error) {
    res.status(500).send(error.message)
  }
})

app.put('/descancelarSesion/:id', async (req, res) => {
  try {
    const database = client.db('construccion');
    const collection = database.collection('sesion');
    const consulta = { _id: new ObjectId(req.params.id) };
    const result = await collection.updateOne(consulta, {
      $set: { cancelada: false }
    });
    if (result.modifiedCount === 1) {
      console.log('Sesión descancelada con éxito');
      res.send(result);
    } else {
      console.log('Sesión no encontrada');
      res.status(404).send('Sesion no encontrada');
    }
  } catch (error) {
    console.log('Error al descancelar la sesión:', error.message);
    res.status(500).send(error.message);
  }
});



app.post('/publicarProblema', async (req, res) => {
  try {
    const database = client.db('construccion')
    const problemas = database.collection('problemas')
    const problema = { descripcion: req.body.descripcion, usuarioId: req.body.idUsuario }
    const result = await problemas.insertOne(problema)
    res.send(result)
  } catch (error) {
    console.error(error)
    res.status(500).send(error.message)
  }
})
