import * as Yup from 'yup';
import moment from 'moment-timezone';
import User from '../models/User';
import File from '../models/File';
import Person from '../models/Person';
import Log from '../schema/Log';

class UserController {
  async index(req, res) {
    // Verifica perfil usuário
    if (req.userProfile < process.env.LEVAL_ADMINISTRATOR)
      return res.status(400).json({ error: 'User does not have permission' });

    const { page = 1 } = req.query;

    const users = await User.findAll({
      order: ['email'],
      limit: 20,
      offset: (page - 1) * 20,
      include: { association: 'person', attributes: ['name', 'phone'] },
      attributes: ['id', 'email', 'profile', 'createdAt'],
    });
    return res.json(users);
  }

  async store(req, res) {
    if (req.userProfile < process.env.LEVAL_OPERATOR)
      return res.status(400).json({ error: 'User does not have permission' });

    const { email, password, profile } = req.body;
    // Validação de dados de entrada (lib YUP)
    const schema = Yup.object().shape({
      email: Yup.string()
        .email()
        .required(),
      password: Yup.string()
        .required()
        .min(6),
    });

    if (!(await schema.isValid(req.body))) {
      return res
        .status(401)
        .json({ error: 'Validation fail. Some field is missing.' });
    }

    const { person_id } = req.params;

    const person = await Person.findByPk(person_id);

    /* VERIFY IF ALREADY USER, EMAIL */
    if (!person) {
      return res.status(401).json({ error: 'Person not found' });
    }

    const userExists = await User.findOne({ where: { email } });

    if (userExists) res.status(400).json({ error: 'Email already exists.' });

    const personExists = await User.findOne({ where: { person_id } });

    if (personExists)
      res.status(400).json({ error: 'Person already exists outher user.' });
    /* END VERIFY */

    try {
      const { id } = await User.create({
        person_id,
        email,
        password,
        profile,
      });

      /*
      SENT SYSTEM LOG
      */
      await Log.create({
        application: `${process.env.APP_NAME}/${process.env.COMPANY}`,
        content: `Um novo usuário para ${person.name} foi criado na ${moment()
          .locale('pt-br')
          .tz(process.env.TIMEZONE)
          .format('LLLL')}`,
        user: req.userId,
      });
      /*
      END LOG
      */

      return res.json({
        id,
        person_id,
        email,
        profile,
      });
    } catch (err) {
      const { message, type, path, value } = err.errors[0];

      res.json({ message, type, path, value });
    }

    return res
      .status(502)
      .json({ error: 'Erro ocurred. Contact the system manager' });
  }

  async update(req, res) {
    // Verifica perfil usuário
    if (req.userProfile < process.env.LEVAL_OPERATOR)
      return res.status(400).json({ error: 'User does not have permission' });

    // Validação de dados de entrada
    const schema = Yup.object().shape({
      email: Yup.string().email(),
      oldPassword: Yup.string().min(6),
      password: Yup.string()
        .min(6)
        .when('oldPassowrd', (oldPassword, field) =>
          oldPassword ? field.required() : field
        ),
      confirmPassword: Yup.string().when('password', (password, field) =>
        password ? field.required().oneOf([Yup.ref('password')]) : field
      ),
    });

    if (!(await schema.isValid(req.body))) {
      return res
        .status(401)
        .json({ error: 'Validation fail. Some field is missing.' });
    }

    const { id } = req.params;

    const { email, oldPassword } = req.body;

    const user = await User.findByPk(id);

    // Verifica email
    if (email !== user.email) {
      const userExists = await User.findOne({ where: { email } });

      if (userExists) res.status(400).json({ error: 'User already exists.' });
    }

    // Verifica se foi preenchido a senha e compara a senhas senhas
    if (oldPassword && !(await user.checkPassword(oldPassword)))
      res.status(401).json({ error: 'Password does not match' });

    await user.update(req.body);
    const { name, profile, avatar } = await User.findByPk(id, {
      include: [
        {
          model: File,
          as: 'avatar',
          attributes: ['id', 'path', 'url'],
        },
      ],
    });

    /*
      SENT SYSTEM LOG
      */
    await Log.create({
      application: `${process.env.APP_NAME}/${process.env.COMPANY}`,
      content: `O usuário de login ${email} foi modificado em ${moment()
        .locale('pt-br')
        .tz(process.env.TIMEZONE)
        .format('LLLL')}`,
      user: req.userId,
    });
    /*
    END LOG
    */

    return res.json({
      id,
      name,
      email,
      profile,
      avatar,
    });
  }
}

export default new UserController();
