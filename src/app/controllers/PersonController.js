import * as Yup from 'yup';
import Person from '../models/Person';

class PersonController {
  async index(req, res) {
    if (req.userProfile < process.env.LEVEL_ADMINISTRADOR)
      return res.status(400).json({ error: 'User does not have permission' });

    const { page = 1 } = req.query;

    const people = await Person.findAll({
      order: ['name'],
      limit: 20,
      offset: (page - 1) * 20,
    });

    return res.json(people);
  }

  async store(req, res) {
    const { name, phone, document } = req.body;

    const schema = Yup.object().shape({
      name: Yup.string().required(),
      phone: Yup.string().required(),
      document: Yup.string().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res
        .status(401)
        .json({ error: 'Validation fail. Some required field is missing' });
    }

    const personExists = await Person.findOne({
      where: {
        document,
      },
    });

    if (personExists)
      return res.status(401).json({ error: 'Person alrealy exists.' });

    const person = await Person.create({
      name,
      phone,
      document,
    });

    return res.json(person);
  }

  async show(req, res) {
    const person = await Person.findByPk(req.params.id);
    res.json(person);
  }

  async update(req, res) {
    if (req.userProfile < process.env.LEVEL_ADMINISTRADOR)
      return res.status(400).json({ error: 'User does not have permission' });

    const { id } = req.params;

    const person = await Person.findByPk(id);

    try {
      const personUpdate = await person.update(req.body);

      return res.json(personUpdate);
    } catch (err) {
      const { message, type, path, value } = err.errors[0];

      res.json({ message, type, path, value });
    }
    return res
      .status(400)
      .json({ error: 'Erro ocurred. Contact the system manager' });
  }
}

export default new PersonController();
