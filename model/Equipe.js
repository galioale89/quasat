const mongoose = require('mongoose')
const Schema = mongoose.Schema

const Equipe = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'usuario',
    require: true
  },
  projeto: {
    type: Schema.Types.ObjectId,
    ref: 'projeto',
    require: true
  },  
  ehpadrao: {
    type: Boolean,
    require: false,
  },
  tarefa: {
    type: Schema.Types.ObjectId,
    ref: 'tarefas',
    require: false
  },
  obra: {
    type: Schema.Types.ObjectId,
    ref: 'tarefas',
    require: false
  },
  insres: {
    type: Schema.Types.ObjectId,
    ref: 'pessoa',
    require: false
  },
  qtdmod: {
    type: Number,
  },  
  nome_projeto: {
    type: String,
    require: false
  },
  ativo: {
    type: Boolean,
    require: false,
  },
  nome: {
    type: String,
    require: false
  },
  nome_equipe: {
    type: String,
    require: false
  },
  custoins: {
    type: Number,
    require: false
  },
  custoele: {
    type: Number,
    require: false
  },
  feito: {
    type: Boolean,
    require: false
  },
  liberar: {
    type: Boolean,
    require: false
  },
  parado: {
    type: Boolean,
    require: false
  },
  prjfeito: {
    type: Boolean,
    require: false
  },
  dtinicio: {
    type: String,
    require: false
  },
  dtfim: {
    type: String,
    require: false
  },
  observacao: {
    type: String,
    require: false
  },
  dtinibusca: {
    type: Number,
    require: false
  },
  dtfimbusca: {
    type: Number,
    require: false
  },
})

mongoose.model('equipe', Equipe)