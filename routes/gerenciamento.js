// require('../app')
require('../model/Usuario')
require('../model/Projeto')
require('../model/Empresa')
require('../model/Cliente')
require('../model/Tarefas')
require('../model/Plano')
require('../model/AtvTelhado')
require('../model/AtvAterramento')
require('../model/AtvInversor')
require('../model/Servico')
require('../model/ImagensTarefas')
require('../model/Acesso')
require('../model/Pedido')
require('../model/Pedido')
require('../model/Agenda')
require('../model/AtividadesPadrao')
require('../model/Parametros')
require('../model/Componente')
require('../model/Mensagem')
require('dotenv').config()

const { ehAdmin } = require('../helpers/ehAdmin')

const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const aws = require("aws-sdk")
const multer = require('multer')
const multerS3 = require("multer-s3")
const resizeImg = require('resize-image-buffer')
const xl = require('excel4node')
const sharp = require('sharp')
var excel = require('exceljs')
//const {Client, TextContent} = require('@zenvia/sdk');

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const client = require('twilio')(accountSid, authToken)
// const ListInput = require('../api')
// const list = new ListInput(mongoose, app)

const Usuario = mongoose.model('usuario')
const Acesso = mongoose.model('acesso')
const Empresa = mongoose.model('empresa')
const Cliente = mongoose.model('cliente')
const Usina = mongoose.model('usina')
const Pessoa = mongoose.model('pessoa')
const Tarefas = mongoose.model('tarefas')
const Equipe = mongoose.model('equipe')
const Plano = mongoose.model('plano')
const Projeto = mongoose.model('projeto')
const Servico = mongoose.model('servico')
const Pedido = mongoose.model('pedido')
const Agenda = mongoose.model('agenda')
const AtvPadrao = mongoose.model('atvPadrao')
const Parametros = mongoose.model('parametros')
const Componente = mongoose.model('componente')
const Mensagem = mongoose.model('mensagem')

const dataBusca = require('../resources/dataBusca')
const setData = require('../resources/setData')
const dataMensagem = require('../resources/dataMensagem')
const dataMsgNum = require('../resources/dataMsgNum')
const dataHoje = require('../resources/dataHoje')
const naoVazio = require('../resources/naoVazio')
const mascaraDecimal = require('../resources/mascaraDecimal')
const dataInput = require('../resources/dataInput')
const comparaNum = require('../resources/comparaNumeros')
const listaFotos = require('../resources/listaFotos')
const buscaPrimeira = require('../resources/buscaPrimeira')
const diferencaDias = require('../resources/diferencaDias')

var credentials = new aws.SharedIniFileCredentials({ profile: 'vimmusimg' })
aws.config.credentials = credentials

var s3 = new aws.S3()
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: 'quasatimg',
        //new Date().getSeconds() + '_' + new Date().getFullYear() + '_' + new Date().getMonth() + '_' + new Date().getDate
        key: function (req, file, cb) {
            cb(null, req.body.seq + '_' + file.originalname)
        }
    })
})

async function salvarObservacao(projeto, obsprojetista, id, pessoa) {
    let pessoas = await Pessoa.findById(pessoa);
    let nome_pessoa = pessoas.nome;
    if (obsprojetista != '') {
        var time = String(new Date(Date.now())).substring(16, 21);
        var newdate = dataMensagem(dataHoje());
        if (naoVazio(projeto.obsprojetista)) {
            oldtext = projeto.obsprojetista;
        } else {
            oldtext = '';
        }
        var newtext = '\n' + `[${newdate} - ${time}] por ${nome_pessoa}` + '\n' + obsprojetista + '\n' + oldtext;
        await Projeto.updateOne({ _id: id }, { $set: { obsprojetista: newtext } });
    }
}

router.get('/fotoslocal/:id', ehAdmin, async (req, res) => {
    const projeto = await Projeto.findById(req.params.id);
    var lista_local = [];
    if (naoVazio(projeto.local)) {
        lista_local = listaFotos(projeto.local);
    }
    res.render('principal/fotoslocal', { lista_local })
})

router.get('/obsinstalacao/:id', ehAdmin, async (req, res) => {
    let observacao;
    let ObjectId = mongoose.Types.ObjectId;
    let reg = await Projeto.aggregate([
        {
            $match: {
                _id: ObjectId(String(req.params.id))
            }
        },
        {
            $lookup: {
                from: 'equipes',
                let: { id_equipe: '$equipe' },
                pipeline: [{
                    $match: {
                        $expr: {
                            $eq: ['$_id', "$$id_equipe"]
                        }
                    }
                }],
                as: 'equipes'
            }
        }
    ]);
    reg.map(async item => {
        if (item.equipes.length > 0) {
            let equipes = item.equipes;
            equipes.map(async i => {
                //console.log('i.observacao=>' + i.observacao)
                observacao = i.observacao;
            })
        } else {
            let equipe = await Equipe.findOne({ projeto: req.body.id });
            //console.log('equipe.observacao=>' + equipe.observacao)
            observacao = equipe.observacao;
        }
    })
    //console.log(observacao);
    res.render('principal/obsinstalador', { idprj: req.params.id, observacao });
})

router.get('/mensagem/', ehAdmin, (req, res) => {
    var id
    const { user } = req.user
    const { _id } = req.user

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }
    Mensagem.find({ user: id }).lean().then((mensagem) => {
        res.render('principal/mensagem', { mensagem })
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar as mensagens')
        res.redirect('/dashboard')
    })
})

router.get('/termos/', ehAdmin, (req, res) => {
    var id
    const { user } = req.user
    const { _id } = req.user
    const { pessoa } = req.user
    const { funges } = req.user
    let gestor

    if (naoVazio(user)) {
        id = user
        gestor = funges
    } else {
        id = _id
        gestor = true
    }

    let projetos = []
    let contaDias = 0
    let tamTermo
    let termo
    let datatermo = '00/00/0000'
    let alerta = false
    let sql = {}
    let dataAprova = '00/00/0000'
    let dataTroca = '00/00/0000'
    let datacad = '00/00/0000'
    let q = 0


    if (gestor) {
        sql = { user: id, dataApro: { $exists: true }, encerrado: false }
    } else {
        sql = { user: id, vendedor: pessoa, dataTroca: { $exists: true }, encerrado: false }
    }

    //console.log(JSON.stringify(sql))
    Projeto.find(sql).then((projeto) => {
        if (naoVazio(projeto)) {
            projeto.forEach((e) => {
                Cliente.findOne({ _id: e.cliente }).then((cliente) => {
                    q++
                    if (naoVazio(e.dataApro)) {
                        dataAprova = e.dataApro
                    }
                    //console.log('dataAprova=>' + dataAprova)

                    tamTermo = e.termo
                    //console.log('tamTermo.length=>' + tamTermo.length)
                    if (tamTermo.length > 0) {
                        if (naoVazio(tamTermo[0].data)) {
                            datatermo = tamTermo[0].data
                        }
                    }
                    //console.log('datatermo=>' + datatermo)
                    //console.log('projeto_dataTroca=>' + e.dataTroca)

                    dataTroca = e.dataTroca
                    if (naoVazio(dataTroca)) {
                        if (datatermo != '00/00/0000') {
                            contaDias = diferencaDias(e.dataTroca, datatermo)
                            termo = true
                        } else {
                            contaDias = diferencaDias(e.dataTroca, dataHoje())
                            termo = false
                        }
                        //console.log('contaDias=>' + contaDias)
                        //console.log('termo=>' + termo)
                    }

                    // if (contaDias > 7) {
                    //     alerta = true
                    // }

                    projetos.push({
                        id: e._id,
                        termo,
                        contaDias,
                        seq: e.seq,
                        cliente: cliente.nome,
                        datatermo: dataMensagem(datatermo),
                        dataapro: dataMensagem(dataAprova),
                        datatroca: dataMensagem(dataTroca)
                    })

                    //console.log('q=>' + q)
                    if (q == projeto.length) {
                        res.render('principal/termos', { projetos })
                    }
                }).catch((err) => {
                    req.flash('error_msg', 'Não foi possível encontrar o projeto<termo>')
                    res.redirect('/relatorios/consulta')
                })
            })
        } else {
            res.render('principal/termos')
        }
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar o projeto<sem termo>')
        res.redirect('/relatorios/consulta')
    })
})

router.get('/confirmaexclusao/:id', ehAdmin, (req, res) => {
    Projeto.findOne({ _id: req.params.id }).lean().then((projeto) => {
        res.render('principal/confirmaexclusao', { projeto })
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar o projeto')
        res.redirect('/relatorios/consulta')
    })
})

router.get('/selecao', ehAdmin, (req, res) => {

    let id
    const { _id } = req.user
    const { user } = req.user
    const { pessoa } = req.user
    const { vendedor } = req.user
    const { funges } = req.user

    let ehMaster

    if (naoVazio(user)) {
        id = user
        ehMaster = false
    } else {
        id = _id
        ehMaster = true
    }

    let enviado = []
    let negociando = []
    let baixado = []
    let ganho = []
    let totEnviado = 0
    let totNegociando = 0
    let totPerdido = 0
    let totGanho = 0
    var totAnalise = 0;
    var totComparando = 0;
    var totPreco = 0;

    let hoje = dataHoje()
    let mes = hoje.substring(5, 7)
    let ano = hoje.substring(0, 4)
    let cliente

    let janeiro
    let fevereiro
    let marco
    let abril
    let maio
    let junho
    let julho
    let agosto
    let setembro
    let outubro
    let novembro
    let dezembro
    let todos

    let mestitulo = ''
    let diaini = '01'
    let diafim = ''

    let match = {}

    switch (String(mes)) {
        case '01':
            janeiro = 'active'
            mestitulo = 'Janeiro'
            diafim = '31'
            break;
        case '02':
            fevereiro = 'active'
            mestitulo = 'Fevereiro'
            diafim = '28'
            break;
        case '03':
            marco = 'active'
            mestitulo = 'Março'
            diafim = '31'
            break;
        case '04':
            abril = 'active'
            mestitulo = 'Abril'
            diafim = '30'
            break;
        case '05':
            maio = 'active'
            mestitulo = 'Maio'
            diafim = '31'
            break;
        case '06':
            junho = 'active'
            mestitulo = 'Junho'
            diafim = '30'
            break;
        case '07':
            julho = 'active'
            mestitulo = 'Julho'
            diafim = '31'
            break;
        case '08':
            agosto = 'active'
            mestitulo = 'Agosto'
            diafim = '31'
            break;
        case '09':
            setembro = 'active'
            diafim = '30'
            break;
        case '10':
            outubro = 'active'
            mestitulo = 'Outubro'
            diafim = '31'
            break;
        case '11':
            novembro = 'active'
            mestitulo = 'Novembro'
            diafim = '30'
            break;
        case '12':
            dezembro = 'active'
            mestitulo = 'Dezembro'
            diafim = '31'
            break;
    }

    let dataini = String(ano) + String(mes) + diaini
    let datafim = String(ano) + String(mes) + diafim

    if (naoVazio(vendedor)) {
        match = { user: id, vendedor: pessoa }
    } else {
        match = { user: id }
    }
    Projeto.aggregate([
        {
            $match: match
        },
        {
            $lookup: {
                from: 'clientes',
                let: { id_cliente: "$cliente" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: ["$_id", "$$id_cliente"]
                            }
                        }
                    },
                    {
                        $project: {
                            nome: 1
                        }
                    }],
                as: 'clientes'
            }
        },
        {
            $lookup: {
                from: 'pedidos',
                let: {
                    id_pedido: "$pedido"
                },
                pipeline: [{
                    $match: {
                        $expr: {
                            $eq: ["$_id", "$$id_pedido"]
                        }
                    }
                },
                {
                    $project: { data: 1 }
                }
                ],
                as: "pedidos"
            }
        },
        {
            $project: {
                seq: 1,
                status: 1,
                ganho: 1,
                baixada: 1,
                valor: 1,
                clientes: 1,
                datacad: 1,
                pedidos: 1
            }
        }
    ]).then(result => {
        result.map(item => {
            let dataCliente = item.clientes
            dataCliente.map(i => cliente = i.nome);
            if (item.status == 'Enviado' && item.ganho == false && naoVazio(item.motivo) == false) {
                if (item.datacad < parseFloat(datafim) && item.datacad > parseFloat(dataini)) {
                    if (naoVazio(item.valor)) {
                        totEnviado = totEnviado + item.valor;
                    }
                    enviado.push({ id: item._id, cliente, seq: item.seq, status: item.status });
                }
            }

            let database = item.datacad;
            let dataPedido = item.pedidos;
            if (dataPedido.length > 0) {
                dataPedido.map(i => database = dataBusca(i.data));
            }
            if (item.ganho == true) {
                if (database < parseFloat(datafim) && database > parseFloat(dataini)) {
                    if (naoVazio(item.valor)) {
                        totGanho = totGanho + item.valor;
                    }
                    ganho.push({ id: item._id, cliente, seq: item.seq, status: item.status });
                }
            } else {
                if (item.datacad < parseFloat(datafim) && item.datacad > parseFloat(dataini)) {
                    if (item.baixada == true) {
                        if (naoVazio(item.valor)) {
                            totPerdido = totPerdido + item.valor;
                        }
                        baixado.push({ id: item._id, cliente, seq: item.seq, status: item.status, motivo: item.motivo })
                    } else {
                        if (item.status == 'Negociando' || item.status == 'Analisando Financiamento' || item.status == 'Comparando Propostas' || item.status == 'Aguardando redução de preço') {
                            if (naoVazio(item.valor)) {
                                if (item.status == 'Comparando Propostas') {
                                    totComparando = totComparando + item.valor;
                                }
                                if (item.status == 'Analisando Financiamento') {
                                    totAnalise = totAnalise + item.valor;
                                }
                                if (item.status == 'Aguardando redução de preço') {
                                    totPreco = totPreco + item.valor;
                                }
                                totNegociando = totNegociando + item.valor;
                            }
                            negociando.push({ id: item._id, cliente, seq: item.seq, status: item.status });
                        }
                    }
                }
            }
        })

        totEnviado = mascaraDecimal(totEnviado);
        totGanho = mascaraDecimal(totGanho);
        totPerdido = mascaraDecimal(totPerdido);
        totNegociando = mascaraDecimal(totNegociando);

        enviado.sort(comparaNum);
        negociando.sort(comparaNum);
        ganho.sort(comparaNum);
        baixado.sort(comparaNum);

        //console.log('totComparando=>' + totComparando)
        if (naoVazio(totComparando)) {
            totComparando = mascaraDecimal(totComparando);
        }
        if (naoVazio(totAnalise)) {
            totAnalise = mascaraDecimal(totAnalise);
        }
        if (naoVazio(totPreco)) {
            totPreco = mascaraDecimal(totPreco);
        }
        let numdiaini = parseFloat(diaini);
        let numdiafim = parseFloat(diafim);
        res.render('principal/selecao', {
            enviado, negociando, ganho, baixado, mestitulo, ano, numdiaini, numdiafim,
            janeiro, fevereiro, marco, abril, maio, junho, julho, agosto, setembro, outubro, novembro, dezembro, todos,
            totEnviado, totGanho, totPerdido, totNegociando, totComparando, totAnalise, totPreco, funges, ehMaster
        })
    })
})

router.get('/confirmabaixa/:id', ehAdmin, (req, res) => {
    const { vendedor } = req.user
    Projeto.findOne({ _id: req.params.id }).lean().then((projeto) => {
        Cliente.findOne({ _id: projeto.cliente }).lean().then((cliente) => {
            res.render('principal/confirmabaixa', { projeto, cliente, vendedor })
        }).catch((err) => {
            req.flash('error_msg', 'Não foi possível encontrar o cliente<status>.')
            res.redirect('/dashboard')
        })
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar o projeto<status>.')
        res.redirect('/dashboard')
    })
})

router.get('/confirmastatus/:id', ehAdmin, (req, res) => {
    const { vendedor } = req.user
    Projeto.findOne({ _id: req.params.id }).lean().then((projeto) => {
        Cliente.findOne({ _id: projeto.cliente }).lean().then((cliente) => {
            res.render('principal/confirmastatus', { projeto, cliente, vendedor })
        }).catch((err) => {
            req.flash('error_msg', 'Não foi possível encontrar o cliente<status>.')
            res.redirect('/dashboard')
        })
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar o projeto<status>.')
        res.redirect('/dashboard')
    })
})

router.get('/propostaEntregue/:id', ehAdmin, (req, res) => {
    Projeto.findOne({ _id: req.params.id }).then((projeto) => {
        projeto.entregue = true
        projeto.dtentrega = dataHoje()
        projeto.save().then(() => {
            res.redirect('/dashboard')
        }).catch((err) => {
            req.flash('error_msg', 'Não foi possível encontrar o projeto<entregue>.')
            res.redirect('/dashboard')
        })
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar o projeto<entregue>.')
        res.redirect('/dashboard')
    })
})

router.get('/emandamento/', ehAdmin, (req, res) => {

    const { _id } = req.user
    const { user } = req.user
    var id

    if (naoVazio(user)) {
        id = user
    } else {
        id = _id
    }

    let seq
    let cliente
    let nome_cliente
    let parado
    let autorizado
    let pagamento
    let instalado
    let execucao
    let instalador
    let cidade
    let uf
    let telhado
    let estrutura
    let inversor
    let modulos
    let potencia
    let sistema
    let deadline
    let ins_banco
    let checkReal
    let nome_ins_banco
    let id_ins_banco
    let nome_ins
    let id_ins
    let pedido
    var observacao
    var obsprojetista

    var listaAndamento = []
    var addInstalador = []

    var hoje = dataHoje()
    var anotitulo = hoje.substring(0, 4)
    const dataini = anotitulo + '-01' + '-01'
    const datafim = anotitulo + '-12' + '-31'
    const dtini = parseFloat(dataBusca(dataini))
    const dtfim = parseFloat(dataBusca(datafim))

    //console.log('entrou')
    Cliente.find({ user: id }).lean().then((todos_clientes) => {
        Pessoa.find({ user: id, funins: 'checked' }).lean().then((todos_instaladores) => {

            Equipe.aggregate([
                {
                    $match: {
                        user: id,
                        tarefa: { $exists: false },
                        nome_projeto: { $exists: true },
                        baixada: { $ne: true },
                        "dtfimbusca": {
                            $gte: dtini,
                            $lte: dtfim,
                        }
                    }
                },
                {
                    $lookup: {
                        from: 'projetos',
                        localField: '_id',
                        foreignField: 'equipe',
                        as: 'projeto'
                    }
                },
                {
                    $lookup: {
                        from: 'pessoas',
                        localField: 'insres',
                        foreignField: '_id',
                        as: 'instalador',
                    }
                }
            ]).then(async list => {

                for (const item of list) {
                    observacao = item.observacao;
                    deadline = await item.dtfim;
                    if (naoVazio(deadline) == false) {
                        deadline = '0000-00-00';
                    }
                    qtdmod = await item.qtdmod;


                    let projetos = await item.projeto;
                    let instaladores = await item.instalador;

                    if (projetos.length > 0) {

                        projetos.map(async register => {
                            id = register._id
                            seq = register.seq
                            cidade = register.cidade
                            uf = register.uf
                            telhado = register.telhado
                            estrutura = register.estrutura
                            inversor = register.plaKwpInv
                            modulos = register.plaQtdMod
                            potencia = register.plaWattMod
                            instalado = register.instalado
                            execucao = register.execucao
                            parado = register.parado
                            autorizado = register.autorizado
                            pagamento = register.pago
                            cliente = register.cliente
                            ins_banco = register.ins_banco
                            checkReal = register.ins_real
                            pedido = register.pedido
                            obsprojetista = register.obsprojetista

                            if (checkReal != true) {
                                checkReal = 'unchecked';
                            } else {
                                checkReal = 'checked';
                            }

                            if (naoVazio(modulos) && naoVazio(potencia)) {
                                sistema = ((modulos * potencia) / 1000).toFixed(2);
                            } else {
                                sistema = 0;
                            }

                        })

                        if (naoVazio(pedido)) {

                            instaladores.map(async register => {
                                instalador = register.nome;

                                nome_ins = instalador;
                                id_ins = register._id;

                                if (naoVazio(ins_banco)) {
                                    if (register._id == ins_banco) {
                                        addInstalador = [{ instalador, qtdmod }];
                                    } else {
                                        let nome_instalador = await Pessoa.findById(ins_banco);
                                        addInstalador = [{ instalador: nome_instalador.nome, qtdmod }];
                                    }
                                } else {
                                    addInstalador = [{ instalador, qtdmod }];
                                }
                            })

                            if (naoVazio(ins_banco)) {
                                await Pessoa.findById(ins_banco).then(this_ins_banco => {
                                    nome_ins_banco = this_ins_banco.nome;
                                    id_ins_banco = this_ins_banco._id;
                                })
                            } else {
                                nome_ins_banco = '';
                                id_ins_banco = '';
                            }

                            await Cliente.findById(cliente).then(this_cliente => {
                                nome_cliente = this_cliente.nome;
                            })

                            listaAndamento.push({
                                id, seq, parado, execucao, autorizado, pagamento, observacao, obsprojetista,
                                instalado, cliente: nome_cliente, cidade, uf, telhado, estrutura,
                                sistema, modulos, potencia, inversor, deadline, addInstalador,
                                dtfim: dataMensagem(deadline), nome_ins_banco, id_ins_banco, nome_ins, id_ins, checkReal
                            })

                            addInstalador = [];
                        }
                    }
                }

                listaAndamento.sort(comparaNum);
                res.render('principal/emandamento', {
                    listaAndamento, todos_clientes,
                    todos_instaladores, datafim, dataini
                })
            })

        }).catch((err) => {
            req.flash('error_msg', 'Nenhum instalador encontrado.')
            res.redirect('/dashboard')
        })
    }).catch((err) => {
        req.flash('error_msg', 'Nenhum cliente encontrado.')
        res.redirect('/dashboard')
    })
})

router.get('/mostraEquipe/:id', ehAdmin, (req, res) => {
    Projeto.findOne({ _id: req.params.id }).lean().then((projeto) => {
        if (naoVazio(projeto)) {
            Cliente.findOne({ _id: projeto.cliente }).lean().then((cliente) => {
                Equipe.findOne({ _id: projeto.equipe }).lean().then((equipe) => {
                    Pessoa.findOne({ _id: projeto.responsavel }).lean().then((responsavel) => {
                        Pessoa.findOne({ _id: equipe.insres }).lean().then((insres) => {
                            res.render('principal/mostraEquipe', { servico: params[1], projeto, equipe, cliente, responsavel, insres })
                        }).catch((err) => {
                            req.flash('error_msg', 'Falha ao encontrar o instalador responsável.')
                            res.redirect('/dashboard')
                        })
                    }).catch((err) => {
                        req.flash('error_msg', 'Falha ao encontrar o responsável.')
                        res.redirect('/dashboard')
                    })
                }).catch((err) => {
                    req.flash('error_msg', 'Falha ao encontrar a equipe.')
                    res.redirect('/dashboard')
                })
            }).catch((err) => {
                req.flash('error_msg', 'Falha ao encontrar o cliente.')
                res.redirect('/dashboard')
            })
        } else {
            var realizar
            //console.log('mostrar tarefa')
            Tarefas.findOne({ _id: req.params.id }).lean().then((tarefa) => {
                //console.log(tarefa)
                if (naoVazio(tarefa)) {
                    Servico.findOne({ _id: tarefa.servico }).lean().then((servico) => {
                        Cliente.findOne({ _id: tarefa.cliente }).lean().then((cliente) => {
                            Equipe.findOne({ _id: tarefa.equipe }).lean().then((equipe) => {
                                Pessoa.findOne({ _id: tarefa.responsavel }).lean().then((tecnico) => {
                                    realizar = equipe.feito
                                    Pessoa.findOne({ _id: tarefa.gestor }).lean().then((gestor) => {
                                        res.render('principal/mostraEquipe', { servico, realizar, tarefa, equipe, cliente, tecnico, gestor })
                                    }).catch((err) => {
                                        req.flash('error_msg', 'Falha ao encontrar o gestor responsável.')
                                        res.redirect('/dashboard')
                                    })
                                }).catch((err) => {
                                    req.flash('error_msg', 'Falha ao encontrar o tecnico responsável.')
                                    res.redirect('/dashboard')
                                })
                            }).catch((err) => {
                                req.flash('error_msg', 'Falha ao encontrar a equipe.')
                                res.redirect('/dashboard')
                            })
                        }).catch((err) => {
                            req.flash('error_msg', 'Falha ao encontrar o cliente.')
                            res.redirect('/dashboard')
                        })
                    }).catch((err) => {
                        req.flash('error_msg', 'Falha ao encontrar o serviço.')
                        res.redirect('/dashboard')
                    })
                } else {
                    req.flash('error_msg', 'Equipe não formada.')
                    res.redirect('/dashboard')
                }
            }).catch((err) => {
                req.flash('error_msg', 'Falha ao encontrar a tarefa.')
                res.redirect('/dashboard')
            })
        }
    }).catch((err) => {
        req.flash('error_msg', 'Falha ao encontrar a projeto<me>.')
        res.redirect('/dashboard')
    })
})

router.get('/realizar/:id', ehAdmin, (req, res) => {
    Tarefas.findOne({ _id: req.params.id }).then((tarefa) => {
        Equipe.findOne({ _id: tarefa.equipe }).then((equipe) => {
            equipe.feito = true
            equipe.save().then(() => {
                tarefa.concluido = true
                tarefa.dataentrega = dataBusca(dataHoje())
                tarefa.save().then(() => {
                    res.redirect('/gerenciamento/mostraEquipe/' + tarefa._id)
                }).catch((err) => {
                    req.flash('error_msg', 'Falha ao salvar a tarefa.')
                    res.redirect('/dashboard')
                })
            }).catch((err) => {
                req.flash('error_msg', 'Falha ao salvar a equipe.')
                res.redirect('/dashboard')
            })
        }).catch((err) => {
            req.flash('error_msg', 'Falha ao encontrar a equipe.')
            res.redirect('/dashboard')
        })
    }).catch((err) => {
        req.flash('error_msg', 'Falha ao encontrar a tarefa.')
        res.redirect('/dashboard')
    })
})

router.get('/mostrarFotos/:id', ehAdmin, (req, res) => {
    //console.log('entrou')
    var lista_imagens = []
    var img = []
    var params = req.params.id
    //console.log('params=>' + params)
    params = params.split('@')
    //console.log('tarefa=>' + params[0])
    //console.log('projeto=>' + params[1])
    //console.log('proposta vazio')
    if (params[0] == 'assistencia') {
        //console.log("entrou")
        Tarefas.findOne({ _id: params[1] }).lean().then((tarefa) => {
            img = tarefa.fotos
            //console.log('img.length=>' + img.length)
            img.forEach((e) => {
                lista_imagens.push({ imagem: e.desc, id: params[1] })
            })
            res.render('principal/mostrarFotos', { assistencia: true, lista_imagens, tarefa, seqrf: img.length })
        }).catch((err) => {
            req.flash('error_msg', 'Não foi possível encontrar a tarefa.')
            res.redirect('/gerenciamento/mostrarFotos/' + params[1])
        })
    } else {
        Tarefas.findOne({ _id: params[1] }).lean().then((tarefa) => {
            Projeto.findOne({ _id: tarefa.projeto }).lean().then((projeto) => {
                Tarefas.find({ projeto: params[2] }).lean().then((tarefas) => {

                    img = tarefa.fotos
                    //console.log('img=>' + img.length)
                    if (img.length > 0) {
                        //console.log('img.length=>' + img.length)
                        img.forEach((e) => {
                            lista_imagens.push({ imagem: e.desc, id: params[1] })
                        })
                    }
                    //console.log('lista_imagens=>' + lista_imagens)
                    res.render('principal/mostrarFotos', { lista_imagens, tarefa, tarefas, projeto, titulo: tarefa.descricao, seqtrf: img.length })
                }).catch((err) => {
                    req.flash('error_msg', 'Não foi possível encontrar as tarefas.')
                    res.redirect('/dashboard')
                })
            }).catch((err) => {
                req.flash('error_msg', 'Não foi possível encontrar o projeto.')
                res.redirect('/dashboard')
            })
        }).catch((err) => {
            req.flash('error_msg', 'Não foi possível encontrar a tarefa.')
            res.redirect('/dashboard')
        })
    }
})

router.get('/orcamento', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    const { vendedor } = req.user
    const { funges } = req.user
    const { orcamentista } = req.user

    var id
    var valor
    var campo = ''
    var options = ''
    var selectini = ''
    var selectfim = ''
    var lista_itens = []
    var lista_params = []
    var x = 0

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }
    var quebra = false
    Componente.find({ user: id, classificacao: 'solar' }).lean().then((equipamento) => {
        Parametros.find({ user: id, tipo: 'solar' }).then((parametros) => {
            //console.log('tems params')
            parametros.forEach((e) => {
                //console.log('valor=>' + e.valor)
                if (naoVazio(e.valor)) {
                    valor = e.valor.split(';')
                    //console.log('valor=>' + valor)
                    if (valor.length > 1) {
                        selectini = '<select name="params[]" class="form-select form-select-sm mb-1">'
                        selectfim = '</select>'
                        for (let i = 0; i < valor.length; i++) {
                            //console.log('i=>'+i)
                            //console.log('valor=>'+valor[i])
                            options = options + '<option value="' + valor[i] + '">' + valor[i] + '</option>'
                        }
                        //console.log('dados=>' + dados[x].descricao)
                        //console.log('valor=>' + e.descricao)
                        if (dados[x].descricao == e.descricao) {
                            options = '<option class="fw-bold" value="' + dados[x].valor + '">' + dados[x].valor + '</option>' + options
                        }
                        campo = selectini + options + selectfim
                    } else {
                        //console.log('input type text')
                        campo = '<input type="text" class="form-control form-control-sm mb-1" name="params[]" value="">'
                    }
                } else {
                    //console.log('input type text vazio')
                    campo = '<input type="text" class="form-control form-control-sm mb-1" name="params[]" value="">'
                }
                lista_itens.push({ desc: e.descricao })
                //console.log('campo=>' + campo)
                //console.log('descricao=>' + e.descricao)
                lista_params.push({ id: e._id, descricao: e.descricao, campo })
                campo = ''
                options = ''
                x++
            })
            if (naoVazio(user)) {
                if (vendedor == true) {
                    Acesso.findOne({ _id: _id }).then((acesso) => {
                        //console.log('acesso.pessoa=>' + acesso.pessoa)
                        Pessoa.findOne({ user: id, _id: acesso.pessoa }).then((ven) => {
                            //console.log('ven._id=>' + ven._id)
                            res.render('principal/orcamento', { vendedor, idven: ven._id, equipamento, lista_params, lista_itens })
                        }).catch((err) => {
                            req.flash('error_msg', 'Não foi possível encontrar o responsável.')
                            res.redirect('/dashboard')
                        })
                    }).catch((err) => {
                        req.flash('error_msg', 'Não foi possível encontrar o acesso.')
                        res.redirect('/dashboard')
                    })
                } else {
                    if (orcamentista == true || funges == true) {
                        quebra = true
                    }
                    Pessoa.find({ user: id, vendedor: 'checked' }).lean().then((todos_vendedores) => {
                        res.render('principal/orcamento', { todos_vendedores, quebra, equipamento, lista_params, lista_itens })
                    }).catch((err) => {
                        req.flash('error_msg', 'Não foi possível encontrar o responsável.')
                        res.redirect('/dashboard')
                    })
                }
            } else {
                Pessoa.find({ user: id, vendedor: 'checked' }).lean().then((todos_vendedores) => {
                    res.render('principal/orcamento', { todos_vendedores, quebra: true, equipamento, lista_params, lista_itens })
                }).catch((err) => {
                    req.flash('error_msg', 'Não foi possível encontrar o responsável.')
                    res.redirect('/dashboard')
                })
            }
        }).catch((err) => {
            req.flash('error_msg', 'Não foi possível encontrar os parâmetros.')
            res.redirect('/dashboard')
        })
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar os equipamentos.')
        res.redirect('/dashboard')
    })
})

router.post('/orcamento', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    const { vendedor } = req.user
    const { funges } = req.user
    const { orcamentista } = req.user

    var id
    //var tipo = req.body.seltipo
    //console.log('tipo=>' + tipo)

    var lista_params = []
    var lista_itens = []
    var valor = []
    var selectini
    var selectfim
    var options = ''
    var campo


    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }

    AtvPadrao.find({ user: id }).then((atvpadrao) => {
        if (naoVazio(atvpadrao)) {
            var quebra = false
            //console.log('req.body.tipo =>' + req.body.seltipo )
            Componente.find({ user: id, classificacao: 'solar' }).lean().then((equipamento) => {
                Parametros.find({ user: id, tipo: 'solar' }).then((parametros) => {
                    parametros.forEach((e) => {
                        //console.log('e.valor=>'+e.valor)
                        if (naoVazio(e.valor)) {
                            valor = e.valor.split(';')
                            //console.log('valor.length=>'+valor.length)
                            if (valor.length > 1) {
                                selectini = '<select name="params[]" class="form-select form-select-sm mb-1">'
                                selectfim = '</select>'
                                for (let i = 0; i < valor.length; i++) {
                                    //console.log('i=>'+i)
                                    //console.log('valor=>'+valor[i])
                                    options = options + '<option value="' + valor[i] + '">' + valor[i] + '</option>'
                                }
                                campo = selectini + options + selectfim
                            } else {
                                campo = '<input type="text" class="form-control form-control-sm mb-1" name="params[]" value="' + e.valor + '">'
                            }
                        } else {
                            campo = '<input type="text" class="form-control form-control-sm mb-1" name="params[]" value="">'
                        }
                        lista_itens.push({ desc: e.descricao })
                        //console.log('campo=>'+campo)
                        //console.log('descricao=>'+e.descricao)
                        lista_params.push({ id: e._id, descricao: e.descricao, campo })
                        campo = ''
                        options = ''
                    })
                    //console.log('req.body.cliente=>' + req.body.cliente)
                    if (naoVazio(req.body.cliente)) {
                        Cliente.findOne({ _id: req.body.cliente }).lean().then((cliente) => {
                            if (naoVazio(user)) {
                                if (vendedor == true) {
                                    Acesso.findOne({ _id: _id }).then((acesso) => {
                                        //console.log('acesso.pessoa=>' + acesso.pessoa)
                                        Pessoa.findOne({ user: id, _id: acesso.pessoa }).then((ven) => {
                                            //console.log('ven._id=>' + ven._id)
                                            res.render('principal/orcamento', { vendedor: vendedor, equipamento, idven: ven._id, cliente, lista_params, lista_itens })
                                        }).catch((err) => {
                                            req.flash('error_msg', 'Não foi possível encontrar o responsável.')
                                            res.redirect('/dashboard')
                                        })
                                    }).catch((err) => {
                                        req.flash('error_msg', 'Não foi possível encontrar o acesso.')
                                        res.redirect('/dashboard')
                                    })
                                } else {
                                    if (orcamentista == true || funges == true) {
                                        quebra = true
                                    }
                                    Pessoa.find({ user: id, vendedor: 'checked' }).lean().then((todos_vendedores) => {
                                        res.render('principal/orcamento', { todos_vendedores, equipamento, quebra, cliente, lista_params, lista_itens })
                                    }).catch((err) => {
                                        req.flash('error_msg', 'Não foi possível encontrar o responsável.')
                                        res.redirect('/dashboard')
                                    })
                                }
                            } else {
                                Pessoa.find({ user: id, vendedor: 'checked' }).lean().then((todos_vendedores) => {
                                    res.render('principal/orcamento', { todos_vendedores, equipamento, quebra: true, cliente, lista_params, lista_itens })
                                }).catch((err) => {
                                    req.flash('error_msg', 'Não foi possível encontrar o responsável.')
                                    res.redirect('/dashboard')
                                })
                            }
                        }).catch((err) => {
                            req.flash('error_msg', 'Não foi possível encontrar o cliente.')
                            res.redirect('/dashboard')
                        })
                    } else {
                        if (naoVazio(user)) {
                            //console.log('entrou')
                            //console.log('vendedor=>'+vendedor)
                            if (vendedor == true) {
                                Acesso.findOne({ _id: _id }).then((acesso) => {
                                    //console.log('acesso.pessoa=>' + acesso.pessoa)
                                    Pessoa.findOne({ user: id, _id: acesso.pessoa }).then((ven) => {
                                        //console.log('ven._id=>' + ven._id)
                                        res.render('principal/orcamento', { vendedor, equipamento, idven: ven._id, lista_params, lista_itens })
                                    }).catch((err) => {
                                        req.flash('error_msg', 'Não foi possível encontrar o responsável.')
                                        res.redirect('/dashboard')
                                    })
                                }).catch((err) => {
                                    req.flash('error_msg', 'Não foi possível encontrar o acesso.')
                                    res.redirect('/dashboard')
                                })
                            } else {
                                if (orcamentista == true || funges == true) {
                                    quebra = true
                                }
                                Pessoa.find({ user: id, vendedor: 'checked' }).lean().then((todos_vendedores) => {
                                    res.render('principal/orcamento', { todos_vendedores, equipamento, quebra, lista_params, lista_itens })
                                }).catch((err) => {
                                    req.flash('error_msg', 'Não foi possível encontrar o responsável.')
                                    res.redirect('/dashboard')
                                })
                            }
                        } else {
                            //console.log('lista_params=>'+lista_params)
                            Pessoa.find({ user: id, vendedor: 'checked' }).lean().then((todos_vendedores) => {
                                res.render('principal/orcamento', { todos_vendedores, equipamento, quebra: true, tipo, lista_params, lista_itens })
                            }).catch((err) => {
                                req.flash('error_msg', 'Não foi possível encontrar os parâmetros.')
                                res.redirect('/dashboard')
                            })

                        }
                    }
                }).catch((err) => {
                    req.flash('error_msg', 'Não foi possível encontrar os parâmetros.')
                    res.redirect('/dashboard')
                })
            }).catch((err) => {
                req.flash('error_msg', 'Não foi possível encontrar os componentes<orcven>.')
                res.redirect('/dashboard')
            })
        } else {
            req.flash('error_msg', 'Não foi possível encontrar as atividades padrão. Realize o cadastro das atividades para iniciar uma obra ou serviço.')
            res.redirect('/gerenciamento/atividadesPadrao')
        }
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar as atividades padrão.')
        res.redirect('/cliente/novo')
    })
})

router.get('/fotos', ehAdmin, (req, res) => {
    res.render('principal/fotos')
})

router.post('/addorcamento/', ehAdmin, async (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    const { pessoa } = req.user
    const { vendedor } = req.user

    var q = 0
    var texto

    var id
    var sql_aux = {}
    var sql = {}
    var params = []
    var material = []
    var dados
    var dados_desc
    var dados_qtd
    var cpf
    var cnpj
    var novo = false
    var amplia = false
    var tipo = req.body.tipo

    if (tipo == 'novo') {
        novo = true
    }
    if (tipo == 'ampliacao') {
        amplia = true
    }
    if (naoVazio(user)) {
        id = user
    } else {
        id = _id
    }

    var erros = []
    var idprojeto = []
    var corpo = []
    var corpoVen = []
    var projeto = []
    var cliente = []
    var temvendedor = []
    idprojeto = req.body.id
    idprojeto = String(idprojeto).split(',')

    if (naoVazio(idprojeto[0])) {
        Projeto.findOne({ _id: idprojeto[0] }).then((projeto) => {
            // potencia = Math.trunc(parseFloat(req.body.plaQtdMod) * parseFloat(req.body.plaWattMod), 1) / 1000
            // projeto.potencia = potencia
            projeto.endereco = buscaPrimeira(req.body.endereco)
            projeto.numero = req.body.numero
            projeto.bairro = req.body.bairro
            projeto.cep = req.body.cep
            projeto.complemento = req.body.complemento
            if (vendedor == false) {
                projeto.vendedor = req.body.vendedor
                projeto.vlrServico = req.body.vlrServico
                projeto.vlrKit = req.body.vlrKit
                projeto.valor = req.body.vlrTotal
                projeto.plaQtdMod = req.body.plaQtdMod
                projeto.plaWattMod = req.body.plaWattMod
                projeto.plaQtdInv = req.body.plaQtdInv
                projeto.plaKwpInv = req.body.plaKwpInv
                projeto.plaDimArea = req.body.plaDimArea
                projeto.plaQtdString = req.body.plaQtdString
            }
            projeto.cidade = req.body.cidade
            projeto.uf = req.body.estado
            projeto.datacad = dataBusca(dataHoje())

            projeto.telhado = req.body.telhado
            projeto.estrutura = req.body.estrutura
            projeto.concessionaria = req.body.concessionaria
            projeto.orientacao = req.body.orientacao
            if (vendedor == false) {
                projeto.valor = req.body.valor
            }

            projeto.descuc = req.body.descuc
            projeto.descug = req.body.descug
            // projeto.obsgeral = req.body.obsgeral
            projeto.pagamento = req.body.pagamento
            projeto.pagador = req.body.pagador
            projeto.prazo = req.body.dataprazo

            dados = req.body.campos
            dados_desc = req.body.dados_desc
            dados_qtd = req.body.dados_qtd

            projeto.save().then(() => {
                Parametros.find({ user: id, tipo: 'solar' }).then((lista_params) => {
                    dados = dados.split(';')
                    for (let i = 0; i < lista_params.length; i++) {
                        //console.log('lista_params[]._id=>' + lista_params[i]._id)
                        //console.log('lista_params[].descricao=>' + lista_params[i].descricao)
                        //console.log('dados[]=>' + dados[i])
                        params.push({ descricao: lista_params[i].descricao, tipo: lista_params[i].opcao, valor: dados[i] })
                    }

                    dados_desc = dados_desc.split(';')
                    dados_qtd = dados_qtd.split(';')
                    //console.log('dados_desc.length=>' + dados_desc.length)
                    // if (dados_desc.length > 1) {
                    //console.log('dados_desc[]=>' + dados_desc[0])
                    for (let i = 0; i < dados_desc.length; i++) {
                        //console.log('dados_desc[]=>' + dados_desc[i])
                        //console.log('dados_qtd[]=>' + dados_qtd[i])
                        material.push({ desc: dados_desc[i], qtd: dados_qtd[i] })
                    }
                    // } else {
                    //     material.push({ desc: req.body.dados_desc, qdt: req.body.dados_qtd })
                    // 
                    Projeto.findOneAndUpdate({ _id: projeto._id }, { $set: { params: params } }).then(() => {
                        Projeto.findOneAndUpdate({ _id: projeto._id }, { $push: { material: material } }).then(() => {
                            req.flash('success_msg', 'Proposta salva com sucesso.')
                            res.redirect('/gerenciamento/orcamento/' + idprojeto[0])
                        })
                    })
                }).catch((err) => {
                    req.flash('error_msg', 'Não foi possível encontrar os parâmetros.')
                    res.redirect('/cliente/novo')
                })
            }).catch((err) => {
                req.flash('error_msg', 'Falha ao encontrar a projeto.')
                res.redirect('/gerenciamento/orcamento/' + idprojeto[0])
            })
        }).catch((err) => {
            req.flash('error_msg', 'Falha ao salvar a projeto.')
            res.redirect('/gerenciamento/orcamento/' + idprojeto[0])
        })
    } else {
        var seq
        var numprj

        var nome = buscaPrimeira(req.body.nome)
        // var sobrenome = req.body.sobrenome
        var endereco = buscaPrimeira(req.body.endereco)
        var numero = req.body.numero
        var bairro = buscaPrimeira(req.body.bairro)
        var complemento = buscaPrimeira(req.body.complemento)
        var uf = req.body.estados
        var cep = req.body.cep
        var cidade = buscaPrimeira(req.body.cidade)
        if (naoVazio(req.body.cpf)) {
            cpf = req.body.cpf
        } else {
            cpf = 0
        }
        if (naoVazio(req.body.cnpj)) {
            cnpj = req.body.cnpj
        } else {
            cnpj = 0
        }
        var contato = buscaPrimeira(req.body.contato)
        var celular = req.body.celular
        var email = req.body.email
        var documento = false

        if (naoVazio(cpf) && cpf != 0) {
            documento = true
            sql = { user: id, cpf: cpf }
        } else {
            if (naoVazio(cnpj) && cnpj != 0) {
                documento = true
                sql = { user: id, cnpj: cnpj }
            } else {
                sql = { user: id }
            }
        }
        let sameCliente = false
        if (naoVazio(nome) && naoVazio(celular) && documento == true) {
            try {
                const achou_cliente = await Cliente.findOne(sql)
                if (achou_cliente != null) {
                    //console.log(achou_cliente.vendedor)
                    //console.log(pessoa)
                    if (JSON.stringify(achou_cliente.vendedor) == JSON.stringify(pessoa)) {
                        sameCliente = true
                    }
                }
                //console.log(sameCliente)
                if (sameCliente || achou_cliente == null) {
                    //console.log('entrou')
                    try {
                        const p = await Pessoa.findOne({ _id: pessoa })
                        const empresa = await Empresa.findOne({ user: id })
                        if (naoVazio(empresa.seq)) {
                            seq = parseFloat(empresa.seq) + 1
                            if (naoVazio(empresa.const)) {
                                numprj = empresa.const + (parseFloat(empresa.seq) + 1)
                            } else {
                                numprj = (parseFloat(empresa.seq) + 1)
                            }
                            empresa.seq = seq
                        } else {
                            if (naoVazio(empresa.const)) {
                                numprj = empresa.const + String(1)
                            } else {
                                numprj = 1
                            }
                            empresa.seq = 1
                        }
                        dados = req.body.campos
                        dados_desc = req.body.dados_desc
                        dados_qtd = req.body.dados_qtd
                        Parametros.find({ user: id, tipo: 'solar' }).then((lista_params) => {
                            dados = dados.split(';')
                            for (let i = 0; i < lista_params.length; i++) {
                                params.push({ descricao: lista_params[i].descricao, tipo: lista_params[i].opcao, valor: dados[i] })
                            }
                            dados_desc = dados_desc.split(';')
                            dados_qtd = dados_qtd.split(';')
                            for (let i = 0; i < dados_desc.length; i++) {
                                material.push({ desc: dados_desc[i], qtd: dados_qtd[i] })
                            }
                            if (naoVazio(achou_cliente) && achou_cliente.lead == false) {
                                if (achou_cliente.cnpj == cnpj || achou_cliente.cpf == cpf) {
                                    req.flash('aviso_msg', 'Foi gerado mais um orçamento para o cliente: ' + achou_cliente.nome)
                                }
                                if (tipo == 'novo') {
                                    novo = true
                                } else {
                                    novo = false
                                }
                                if (tipo == 'ampliacao') {
                                    amplia = true
                                } else {
                                    amplia = false
                                }
                                projeto = {
                                    user: id,
                                    cliente: achou_cliente._id,
                                    vendedor: pessoa,
                                    datacad: dataBusca(dataHoje()),
                                    endereco: endereco,
                                    numero: numero,
                                    bairro: bairro,
                                    cep: cep,
                                    complemento: complemento,
                                    cidade: cidade,
                                    uf: uf,
                                    ganho: false,
                                    encerrado: false,
                                    baixada: false,
                                    execucao: false,
                                    parado: false,
                                    entregue: false,
                                    instalado: false,
                                    autorizado: false,
                                    pago: false,
                                    checkpedido: false,
                                    seq: numprj,
                                    status: 'Enviado',
                                    params: params,
                                    material: material,
                                    novo: novo,
                                    ampliacao: amplia,
                                    telhado: req.body.telhado,
                                    orientacao: req.body.orientacao,
                                    estrutura: req.body.estrutura,
                                    concessionaria: req.body.concessionaria
                                }
                                if (vendedor == false) {
                                    corpoVen = {
                                        plaQtdMod: req.body.plaQtdMod,
                                        plaWattMod: req.body.plaWattMod,
                                        plaQtdInv: req.body.plaQtdInv,
                                        plaKwpInv: req.body.plaKwpInv,
                                        plaDimArea: req.body.plaDimArea,
                                        plaQtdString: req.body.plaQtdString,
                                        plaModString: req.body.plaModString,
                                        plaQtdEst: req.body.plaQtdEst,
                                        valor: req.body.valor,
                                    }
                                    corpo = Object.assign(corpo, projeto, corpoVen)
                                } else {
                                    corpo = projeto
                                }
                                //console.log('corpo=>'+JSON.stringify(corpo))
                                new Projeto(corpo).save().then(() => {
                                    Projeto.findOne({ user: id }).sort({ field: 'asc', _id: -1 }).then((novo_projeto) => {
                                        empresa.save().then(() => {
                                            q = 0
                                            var texto
                                            Acesso.find({ user: id, notorc: 'checked' }).then((acesso) => {
                                                //console.log('acesso=>' + acesso)
                                                if (naoVazio(acesso)) {
                                                    acesso.forEach((e) => {
                                                        Pessoa.findOne({ _id: e.pessoa }).then((pessoa) => {
                                                            //console.log('pessoa=>' + pessoa)
                                                            texto = 'Olá ' + pessoa.nome + ',' + '\n' +
                                                                'O orçamento ' + novo_projeto.seq + ' para o cliente ' + achou_cliente.nome + ' foi criado dia ' + dataMensagem(dataHoje()) + ' por: ' + p.nome + '.' + '\n' +
                                                                'Acesse https://vimmus.com.br/gerenciamento/orcamento/' + novo_projeto._id + ' e acompanhe'
                                                            //console.log('pessoa.celular=>'+pessoa.celular)
                                                            client.messages
                                                                .create({
                                                                    body: texto,
                                                                    from: 'whatsapp:+554991832978',
                                                                    to: 'whatsapp:+55' + pessoa.celular
                                                                })
                                                                .then((message) => {
                                                                    q++
                                                                    //console.log('q=>' + q)
                                                                    //console.log('acesso.length=>' + acesso.length)
                                                                    if (q == acesso.length) {
                                                                        //console.log(message.sid)
                                                                        req.flash('success_msg', 'Proposta adicionada com sucesso')
                                                                        res.redirect('/gerenciamento/orcamento/' + novo_projeto._id)
                                                                    }
                                                                }).done()

                                                        }).catch((err) => {
                                                            req.flash('error_msg', 'Houve um erro ao encontrar a pessoa<whats>.')
                                                            res.redirect('/dashboard')
                                                        })
                                                    })
                                                } else {
                                                    req.flash('success_msg', 'Proposta adicionada com sucesso')
                                                    res.redirect('/gerenciamento/orcamento/' + novo_projeto._id)
                                                }
                                            }).catch((err) => {
                                                req.flash('error_msg', 'Houve um erro ao encontrar o acesso.')
                                                res.redirect('/dashboard')
                                            })
                                        }).catch((err) => {
                                            req.flash('error_msg', 'Houve um erro ao salvar a pessoa.')
                                            res.redirect('/dashboard')
                                        })
                                    }).catch((err) => {
                                        req.flash('error_msg', 'Houve um erro ao encontrar o projeto.')
                                        res.redirect('/dashboard')
                                    })
                                }).catch((err) => {
                                    req.flash('error_msg', 'Houve um erro ao salvar a projeto.')
                                    res.redirect('/dashboard')
                                })

                            } else {
                                if (naoVazio(achou_cliente) && achou_cliente.lead == true) {
                                    achou_cliente.nome = buscaPrimeira(req.body.nome)
                                    achou_cliente.endereco = buscaPrimeira(req.body.endereco)
                                    achou_cliente.numero = req.body.numero
                                    achou_cliente.bairro = req.body.bairro
                                    achou_cliente.cep = req.body.cep
                                    achou_cliente.complemento = req.body.complemento
                                    achou_cliente.cidade = req.body.cidade
                                    achou_cliente.uf = req.body.uf
                                    achou_cliente.contato = buscaPrimeira(req.body.contato)
                                    achou_cliente.celular = req.body.celular
                                    achou_cliente.email = req.body.email
                                    achou_cliente.lead = false
                                    if (achou_cliente.novo == 'checked') {
                                        novo = true
                                    }
                                    if (achou_cliente.ampliacao == 'checked') {
                                        amplia = true
                                    }
                                    achou_cliente.save().then(() => {
                                        if (tipo == 'novo') {
                                            novo = true
                                        } else {
                                            novo = false
                                        }
                                        if (tipo == 'ampliacao') {
                                            amplia = true
                                        } else {
                                            amplia = false
                                        }
                                        projeto = {
                                            user: id,
                                            cliente: achou_cliente._id,
                                            vendedor: req.body.vendedor,
                                            datacad: dataBusca(dataHoje()),
                                            endereco: endereco,
                                            numero: numero,
                                            bairro: bairro,
                                            cep: cep,
                                            complemento: complemento,
                                            cidade: cidade,
                                            uf: uf,
                                            ganho: false,
                                            encerrado: false,
                                            baixada: false,
                                            execucao: false,
                                            parado: false,
                                            entregue: false,
                                            instalado: false,
                                            autorizado: false,
                                            pago: false,
                                            checkpedido: false,
                                            seq: numprj,
                                            status: 'Enviado',
                                            params: params,
                                            material: material,
                                            descuc: req.body.descuc,
                                            descug: req.body.descug,
                                            novo: novo,
                                            ampliacao: amplia
                                        }
                                        if (vendedor == false) {
                                            corpoVen = {
                                                plaQtdMod: req.body.plaQtdMod,
                                                plaWattMod: req.body.plaWattMod,
                                                plaQtdInv: req.body.plaQtdInv,
                                                plaKwpInv: req.body.plaKwpInv,
                                                plaDimArea: req.body.plaDimArea,
                                                plaQtdString: req.body.plaQtdString,
                                                plaModString: req.body.plaModString,
                                                plaQtdEst: req.body.plaQtdEst,
                                                valor: req.body.valor,
                                                telhado: req.body.telhado,
                                                orientacao: req.body.orientacao,
                                                valor: req.body.valor,
                                                estrutura: req.body.estrutura,
                                                concessionaria: req.body.concessionaria
                                            }
                                            corpo = Object.assign(corpo, projeto, corpoVen)
                                        } else {
                                            corpo = projeto
                                        }
                                        //console.log('corpo=>'+JSON.stringify(corpo))
                                        new Projeto(corpo).save().then(() => {
                                            Projeto.findOne({ user: id }).sort({ field: 'asc', _id: -1 }).then((novo_projeto) => {
                                                Cliente.findOne({ _id: novo_projeto.cliente }).then((cliente) => {
                                                    empresa.save().then(() => {
                                                        q = 0
                                                        Acesso.find({ user: id, notorc: 'checked' }).then((acesso) => {
                                                            //console.log('acesso=>' + acesso)
                                                            if (naoVazio(acesso)) {
                                                                acesso.forEach((e) => {
                                                                    Pessoa.findOne({ _id: e.pessoa }).then((pessoa) => {
                                                                        //console.log('pessoa=>' + pessoa)
                                                                        texto = 'Olá ' + pessoa.nome + ',' + '\n' +
                                                                            'O orçamento ' + novo_projeto.seq + ' para o cliente ' + cliente.nome + ' foi criado dia ' + dataMensagem(dataHoje()) + ' por: ' + p.nome + '.' + '\n' +
                                                                            'Acesse https://vimmus.com.br/gerenciamento/orcamento/' + novo_projeto._id + ' e acompanhe'
                                                                        //console.log('pessoa.celular=>'+pessoa.celular)
                                                                        client.messages
                                                                            .create({
                                                                                body: texto,
                                                                                from: 'whatsapp:+554991832978',
                                                                                to: 'whatsapp:+55' + pessoa.celular
                                                                            })
                                                                            .then((message) => {
                                                                                q++
                                                                                //console.log('q=>' + q)
                                                                                //console.log('acesso.length=>' + acesso.length)
                                                                                if (q == acesso.length) {
                                                                                    //console.log(message.sid)
                                                                                    req.flash('success_msg', 'Proposta adicionada com sucesso')
                                                                                    res.redirect('/gerenciamento/orcamento/' + novo_projeto._id)
                                                                                }
                                                                            }).done()

                                                                    }).catch((err) => {
                                                                        req.flash('error_msg', 'Houve um erro ao encontrar a pessoa<whats>.')
                                                                        res.redirect('/dashboard')
                                                                    })
                                                                })
                                                            } else {
                                                                req.flash('success_msg', 'Proposta adicionada com sucesso')
                                                                res.redirect('/gerenciamento/orcamento/' + novo_projeto._id)
                                                            }
                                                        }).catch((err) => {
                                                            req.flash('error_msg', 'Houve um erro ao encontrar o acesso.')
                                                            res.redirect('/dashboard')
                                                        })
                                                    }).catch((err) => {
                                                        req.flash('error_msg', 'Houve um erro ao salvar a pessoa.')
                                                        res.redirect('/dashboard')
                                                    })

                                                }).catch((err) => {
                                                    req.flash('error_msg', 'Houve um erro ao encontrar o cliente.')
                                                    res.redirect('/dashboard')
                                                })
                                            }).catch((err) => {
                                                req.flash('error_msg', 'Houve um erro ao encontrar o projeto.')
                                                res.redirect('/dashboard')
                                            })
                                        }).catch((err) => {
                                            req.flash('error_msg', 'Houve um erro ao salvar a projeto.')
                                            res.redirect('/dashboard')
                                        })
                                    }).catch((err) => {
                                        req.flash('error_msg', 'Houve um erro ao salvar o cliente.')
                                        res.redirect('/dashboard')
                                    })
                                } else {
                                    if (tipo == 'novo') {
                                        novo = 'checked'
                                    } else {
                                        novo = 'unchecked'
                                    }
                                    if (tipo == 'ampliacao') {
                                        amplia = 'checked'
                                    } else {
                                        amplia = 'unchecked'
                                    }

                                    corpo = {
                                        user: id,
                                        nome: nome,
                                        endereco: endereco,
                                        numero: numero,
                                        bairro: bairro,
                                        cep: cep,
                                        complemento: complemento,
                                        cidade: cidade,
                                        uf: uf,
                                        cnpj: cnpj,
                                        cpf: cpf,
                                        contato: contato,
                                        celular: celular,
                                        email: email,
                                        lead: false,
                                    }

                                    //console.log('pessoa=>'+pessoa)
                                    if (vendedor) {
                                        Object.assign(cliente, corpo, { vendedor: pessoa })
                                    } else {
                                        Object.assign(cliente, corpo, { vendedor: req.body.vendedor })
                                    }
                                    new Cliente(cliente).save().then(() => {
                                        Cliente.findOne({ user: id }).sort({ field: 'asc', _id: -1 }).then((novo_cliente) => {
                                            //console.log('cliente cadastrado')

                                            if (tipo == 'novo') {
                                                novo = true
                                            } else {
                                                novo = false
                                            }
                                            if (tipo == 'ampliacao') {
                                                amplia = true
                                            } else {
                                                amplia = false
                                            }

                                            if (vendedor) {
                                                selvendedor = pessoa
                                            } else {
                                                selvendedor = req.body.vendedor
                                            }

                                            //console.log('params=>' + JSON.stringify(params))
                                            var ganho
                                            var status

                                            projeto = {
                                                user: id,
                                                cliente: novo_cliente._id,
                                                datacad: dataBusca(dataHoje()),
                                                endereco: endereco,
                                                numero: numero,
                                                bairro: bairro,
                                                cep: cep,
                                                complemento: complemento,
                                                cidade: cidade,
                                                uf: uf,
                                                ganho: false,
                                                encerrado: false,
                                                baixada: false,
                                                execucao: false,
                                                parado: false,
                                                entregue: false,
                                                checkpedido: false,
                                                instalado: false,
                                                autorizado: false,
                                                pago: false,
                                                seq: numprj,
                                                params: params,
                                                material: material,
                                                status: 'Enviado',
                                                novo: novo,
                                                ampliacao: amplia,
                                                telhado: req.body.telhado,
                                                orientacao: req.body.orientacao,
                                                estrutura: req.body.estrutura,
                                                concessionaria: req.body.concessionaria
                                            }

                                            Object.assign(temvendedor, projeto, { vendedor: selvendedor })

                                            if (vendedor == false) {
                                                corpoVen = {
                                                    plaQtdMod: req.body.plaQtdMod,
                                                    plaWattMod: req.body.plaWattMod,
                                                    plaQtdInv: req.body.plaQtdInv,
                                                    plaKwpInv: req.body.plaKwpInv,
                                                    plaDimArea: req.body.plaDimArea,
                                                    plaQtdString: req.body.plaQtdString,
                                                    plaModString: req.body.plaModString,
                                                    plaQtdEst: req.body.plaQtdEst,
                                                    valor: req.body.valor
                                                }
                                                Object.assign(corpo, temvendedor, corpoVen)
                                            } else {
                                                corpo = temvendedor
                                            }

                                            //console.log('corpo=>' + JSON.stringify(corpo))

                                            //console.log('corpo=>'+JSON.stringify(corpo))
                                            new Projeto(corpo).save().then(() => {
                                                Projeto.findOne({ user: id }).sort({ field: 'asc', _id: -1 }).then((novo_projeto) => {
                                                    // Cliente.findOne({ _id: novo_projeto.cliente }).then((cliente) => {
                                                    empresa.save().then(() => {
                                                        q = 0

                                                        Acesso.find({ user: id, notorc: 'checked' }).then((acesso) => {
                                                            //console.log('acesso=>' + acesso)
                                                            if (naoVazio(acesso)) {
                                                                acesso.forEach((e) => {
                                                                    Pessoa.findOne({ _id: e.pessoa }).then((pessoa) => {
                                                                        //console.log('pessoa=>' + pessoa)
                                                                        //console.log('e.nome=>' + e.nome)
                                                                        texto = 'Olá ' + pessoa.nome + ',' + '\n' +
                                                                            'O orçamento ' + novo_projeto.seq + ' para o cliente ' + novo_cliente.nome + ' foi criado dia ' + dataMensagem(dataHoje()) + ' por: ' + p.nome + '.' + '\n' +
                                                                            'Acesse https://quasat.vimmus.com.br/gerenciamento/orcamento/' + novo_projeto._id + ' e acompanhe'
                                                                        //console.log('pessoa.celular=>' + pessoa.celular)
                                                                        client.messages
                                                                            .create({
                                                                                body: texto,
                                                                                from: 'whatsapp:+554991832978',
                                                                                to: 'whatsapp:+55' + pessoa.celular
                                                                            })
                                                                            .then((message) => {
                                                                                q++
                                                                                //console.log('q=>' + q)
                                                                                //console.log('acesso.length=>' + acesso.length)
                                                                                if (q == acesso.length) {
                                                                                    req.flash('success_msg', 'Proposta adicionada com sucesso')
                                                                                    res.redirect('/gerenciamento/orcamento/' + novo_projeto._id)
                                                                                }
                                                                            }).done()

                                                                    }).catch((err) => {
                                                                        req.flash('error_msg', 'Houve um erro ao encontrar a pessoa<whats>.')
                                                                        res.redirect('/dashboard')
                                                                    })
                                                                })
                                                            } else {
                                                                req.flash('success_msg', 'Proposta adicionada com sucesso')
                                                                res.redirect('/gerenciamento/orcamento/' + novo_projeto._id)
                                                            }
                                                        }).catch((err) => {
                                                            req.flash('error_msg', 'Houve um erro ao encontrar o acesso.')
                                                            res.redirect('/dashboard')
                                                        })
                                                    }).catch((err) => {
                                                        req.flash('error_msg', 'Houve um erro ao salvar a pessoa.')
                                                        res.redirect('/dashboard')
                                                    })
                                                }).catch((err) => {
                                                    req.flash('error_msg', 'Houve um erro ao encontrar o projeto.')
                                                    res.redirect('/dashboard')
                                                })
                                            }).catch((err) => {
                                                req.flash('error_msg', 'Houve um erro ao salvar a projeto.')
                                                res.redirect('/dashboard')
                                            })
                                        }).catch((err) => {
                                            req.flash('error_msg', 'Não foi possível encontrar o cliente.')
                                            res.redirect('/cliente/novo')
                                        })
                                    }).catch((err) => {
                                        req.flash('error_msg', 'Não foi possível cadastrar o cliente.')
                                        res.redirect('/cliente/novo')
                                    })
                                }
                            }
                        }).catch((err) => {
                            req.flash('error_msg', 'Não foi possível encontrar os parâmetros.')
                            res.redirect('/cliente/novo')
                        })
                    } catch (error) {
                        req.flash('error_msg', 'Empresa não encontrada: ' + error)
                        req.res('/gerenciamento/orcamento')
                    }

                } else {
                    const vendedor_cliente = await Pessoa.findOne({ _id: achou_cliente.vendedor })
                    try {
                        req.flash('aviso_msg', `O cliente ${achou_cliente.nome} pertence ao vendedor: ${vendedor_cliente.nome}`)
                        res.redirect('/gerenciamento/orcamento')
                    } catch (error) {
                        req.flash('error_msg', 'Vendeor não encontrado: ' + error)
                        req.res('/gerenciamento/orcamento')
                    }

                }
            } catch (error) {
                req.flash('error_msg', 'Cliente não encontrado: ' + error)
                res.redirect('/gerenciamento/orcamento')
            }
        } else {
            erros.push({ texto: 'Os campos marcados com asterisco são obrigatórios' })
            Acesso.findOne({ _id: _id }).then((acesso) => {
                //console.log('acesso.vendedor=>' + acesso.vendedor)
                if (naoVazio(acesso)) {
                    if (acesso.vendedor == true) {
                        //console.log('ehVendedor')
                        //console.log('acesso.pessoa=>' + acesso.pessoa)
                        Pessoa.findOne({ user: id, _id: acesso.pessoa }).then((ven) => {
                            res.render('principal/orcamento', { erros, vendedor, idven: ven._id, nome, endereco, uf, cidade, cpf, cnpj, contato, celular, email }) //sobrenome, 
                        }).catch((err) => {
                            req.flash('error_msg', 'Não foi possível encontrar o vendedor<ven>.')
                            res.redirect('/dashboard')
                        })
                    } else {
                        Pessoa.find({ user: id, vendedor: 'checked' }).lean().then((todos_vendedores) => {
                            res.render('principal/orcamento', { erros, vendedor, todos_vendedores, nome, endereco, uf, cidade, cpf, cnpj, contato, celular, email }) //sobrenome,
                        }).catch((err) => {
                            req.flash('error_msg', 'Não foi possível encontrar o vendedor<funges>.')
                            res.redirect('/dashboard')
                        })
                    }
                } else {
                    Pessoa.find({ user: id, vendedor: 'checked' }).lean().then((todos_vendedores) => {
                        res.render('principal/orcamento', { erros, vendedor, todos_vendedores, nome, endereco, uf, cidade, cpf, cnpj, contato, celular, email }) //sobrenome,
                    }).catch((err) => {
                        req.flash('error_msg', 'Não foi possível encontrar o vendedor<ges>.')
                        res.redirect('/dashboard')
                    })
                }
            }).catch((err) => {
                req.flash('error_msg', 'Não foi possível encontrar o acesso.')
                res.redirect('/dashboard')
            })
        }
    }
})

router.get('/fatura/:id', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    const { vendedor } = req.user
    const { funges } = req.user
    const { funpro } = req.user
    const { instalador } = req.user
    const { orcamentista } = req.user
    var id
    var idAcesso
    var lista_unidades = []
    var media = 0

    var totalJan = 0
    var totalFev = 0
    var totalMar = 0
    var totalAbr = 0
    var totalMai = 0
    var totalJun = 0
    var totalJul = 0
    var totalAgo = 0
    var totalSet = 0
    var totalOut = 0
    var totalNov = 0
    var totalDez = 0

    var ehMaster
    var proandges = false

    if (typeof user == 'undefined') {
        id = _id
        ehMaster = true
    } else {
        id = user
        ehMaster = false
    }
    Projeto.findOne({ _id: req.params.id }).lean().then((projeto) => {
        //console.log('projeto=>' + projeto)
        Cliente.findOne({ _id: projeto.cliente }).lean().then((cliente_projeto) => {
            var ehimagem
            var ehpdf
            var lista_faturas = []
            var lista = []
            lista = projeto.fatura
            lista.forEach((l) => {
                tipo = l.desc
                x = tipo.length
                y = x - 3
                tipo = tipo.slice(y, x)
                //console.log(tipo)
                if (tipo == 'pdf') {
                    ehimagem = false
                    ehpdf = true
                } else {
                    ehimagem = true
                    ehpdf = false
                }
                lista_faturas.push({ desc: l.desc, _id: l._id, ehimagem, ehpdf })
            })
            //console.log('lista=>' + lista_faturas)
            if (naoVazio(vendedor)) {
                idAcesso = _id
            } else {
                idAcesso = id
            }
            var total = 0
            var conta = 0
            if (naoVazio(projeto.uc)) {
                lista_unidades = projeto.uc
                lista_unidades.forEach((e) => {
                    total = total + e.total
                    if (parseFloat(e.jan) > 0) {
                        conta++
                    }
                    if (parseFloat(e.fev) > 0) {
                        conta++
                    }
                    if (parseFloat(e.mar) > 0) {
                        conta++
                    }
                    if (parseFloat(e.abr) > 0) {
                        conta++
                    }
                    if (parseFloat(e.mai) > 0) {
                        conta++
                    }
                    if (parseFloat(e.jun) > 0) {
                        conta++
                    }
                    if (parseFloat(e.jul) > 0) {
                        conta++
                    }
                    if (parseFloat(e.ago) > 0) {
                        conta++
                    }
                    if (parseFloat(e.set) > 0) {
                        conta++
                    }
                    if (parseFloat(e.out) > 0) {
                        conta++
                    }
                    if (parseFloat(e.nov) > 0) {
                        conta++
                    }
                    if (parseFloat(e.dez) > 0) {
                        conta++
                    }

                    totalJan = totalJan + parseFloat(e.jan)
                    totalFev = totalFev + parseFloat(e.fev)
                    totalMar = totalMar + parseFloat(e.mar)
                    totalAbr = totalAbr + parseFloat(e.abr)
                    totalMai = totalMai + parseFloat(e.mai)
                    totalJun = totalJun + parseFloat(e.jun)
                    totalJul = totalJul + parseFloat(e.jul)
                    totalAgo = totalAgo + parseFloat(e.ago)
                    totalSet = totalSet + parseFloat(e.set)
                    totalOut = totalOut + parseFloat(e.out)
                    totalNov = totalNov + parseFloat(e.nov)
                    totalDez = totalDez + parseFloat(e.dez)
                })
                media = Math.round(total / 12)
                //console.log(media)
            }
            if (funges || funpro) {
                proandges = true
            }
            //console.log('lista=>' + JSON.stringify(lista_faturas))
            res.render('principal/fatura', {
                vendedor, orcamentista, funges, ehMaster, funpro, proandges, projeto, cliente_projeto, idAcesso,
                lista_faturas, lista_unidades, media, totalJan, totalFev, totalMar, totalAbr, totalMai,
                totalJun, totalJul, totalAgo, totalSet, totalOut, totalNov, totalDez, total, seqfat: lista.length
            })
        }).catch((err) => {
            req.flash('error_msg', 'Não foi possível encontrar o cliente da proposta<fatura>.')
            res.redirect('/dashboard')
        })
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar o projeto<fatura>.')
        res.redirect('/dashboard')
    })
})

router.post('/salvaruc', ehAdmin, (req, res) => {
    var iduc = req.body.iduc
    var uc = []
    var total
    var id = req.body.id
    var mes = req.body.mes
    var fator

    var totalJan = 0
    var totalFev = 0
    var totalMar = 0
    var totalAbr = 0
    var totalMai = 0
    var totalJun = 0
    var totalJul = 0
    var totalAgo = 0
    var totalSet = 0
    var totalOut = 0
    var totalNov = 0
    var totalDez = 0

    var req_jan = req.body.jan
    var req_fev = req.body.fev
    var req_mar = req.body.mar
    var req_abr = req.body.abr
    var req_mai = req.body.mai
    var req_jun = req.body.jun
    var req_jul = req.body.jul
    var req_ago = req.body.ago
    var req_set = req.body.set
    var req_out = req.body.out
    var req_nov = req.body.nov
    var req_dez = req.body.dez

    var jan = []
    var fev = []
    var mar = []
    var abr = []
    var mai = []
    var jun = []
    var jul = []
    var ago = []
    var set = []
    var out = []
    var nov = []
    var dez = []

    for (let i = 0; i < mes.length; i++) {
        if (naoVazio(req_jan[i]) == false) {
            jan.push(0)
        } else {
            jan.push(req_jan[i])
        }
        if (naoVazio(req_fev[i]) == false) {
            fev.push(0)
        } else {
            fev.push(req_fev[i])
        }
        if (naoVazio(req_mar[i]) == false) {
            mar.push(0)
        } else {
            mar.push(req_mar[i])
        }
        if (naoVazio(req_abr[i]) == false) {
            abr.push(0)
        } else {
            abr.push(req_abr[i])
        }
        if (naoVazio(req_mai[i]) == false) {
            mai.push(0)
        } else {
            mai.push(req_mai[i])
        }
        if (naoVazio(req_jun[i]) == false) {
            jun.push(0)
        } else {
            jun.push(req_jun[i])
        }
        if (naoVazio(req_jul[i]) == false) {
            jul.push(0)
        } else {
            jul.push(req_jul[i])
        }
        if (naoVazio(req_ago[i]) == false) {
            ago.push(0)
        } else {
            ago.push(req_ago[i])
        }
        if (naoVazio(req_set[i]) == false) {
            set.push(0)
        } else {
            set.push(req_set[i])
        }
        if (naoVazio(req_out[i]) == false) {
            out.push(0)
        } else {
            out.push(req_out[i])
        }
        if (naoVazio(req_nov[i]) == false) {
            nov.push(0)
        } else {
            nov.push(req_nov[i])
        }
        if (naoVazio(req_dez[i]) == false) {
            dez.push(0)
        } else {
            dez.push(req_dez[i])
        }
    }

    //console.log(qtd.length)
    //console.log('req.body.id=>' + req.body.id)
    if (mes.length > 1) {
        //console.log('iduc=>' + iduc)
        if (naoVazio(iduc)) {
            //console.log('iduc.length=>' + iduc.length)
            if (iduc.length < 24) {
                for (i = 0; i < iduc.length; i++) {
                    //console.log('iduc=>' + iduc[i])
                    Projeto.findOneAndUpdate({ _id: id }, { $pull: { 'uc': { '_id': iduc[i] } } }).then()
                }
            } else {
                Projeto.findOneAndUpdate({ _id: id }, { $pull: { 'uc': { '_id': iduc } } }).then()
            }
        }


        for (let i = 0; i < mes.length; i++) {
            total = parseFloat(jan[i]) + parseFloat(fev[i]) + parseFloat(mar[i]) + parseFloat(abr[i]) + parseFloat(mai[i]) + parseFloat(jun[i]) +
                parseFloat(jul[i]) + parseFloat(ago[i]) + parseFloat(set[i]) + parseFloat(out[i]) + parseFloat(nov[i]) + parseFloat(dez[i])
            uc.push({
                seq: i + 1, jan: jan[i], fev: fev[i], mar: mar[i], abr: abr[i], mai: mai[i], jun: jun[i],
                jul: jul[i], ago: ago[i], set: set[i], out: out[i], nov: nov[i], dez: dez[i], total: Math.round(total, 2)
            })
        }

        if (naoVazio(req.body.add)) {
            //console.log('req.body.tipoadd =>' + req.body.tipoadd)
            if (req.body.tipoadd == '%') {
                uc.forEach((e) => {
                    totalJan = totalJan + parseFloat(e.jan)
                    totalFev = totalFev + parseFloat(e.fev)
                    totalMar = totalMar + parseFloat(e.mar)
                    totalAbr = totalAbr + parseFloat(e.abr)
                    totalMai = totalMai + parseFloat(e.mai)
                    totalJun = totalJun + parseFloat(e.jun)
                    totalJul = totalJul + parseFloat(e.jul)
                    totalAgo = totalAgo + parseFloat(e.ago)
                    totalSet = totalSet + parseFloat(e.set)
                    totalOut = totalOut + parseFloat(e.out)
                    totalNov = totalNov + parseFloat(e.nov)
                    totalDez = totalDez + parseFloat(e.dez)
                })

                fator = (1 + (req.body.add / 100))
                //console.log('fator =>' + fator)
                //console.log('totalJan=>' + totalJan)
                total = Math.round((parseFloat(totalJan) * fator)) + Math.round((parseFloat(totalFev) * fator)) + Math.round((parseFloat(totalMar) * fator)) + Math.round((parseFloat(totalAbr) * fator)) + Math.round((parseFloat(totalMai) * fator)) + Math.round((parseFloat(totalJun) * fator)) +
                    Math.round((parseFloat(totalJul) * fator)) + Math.round((parseFloat(totalAgo) * fator)) + Math.round((parseFloat(totalSet) * fator)) + Math.round((parseFloat(totalOut) * fator)) + Math.round((parseFloat(totalNov) * fator)) + parseFloat(totalDez) * fator
                uc.push({
                    seq: i + 1, jan: Math.round(parseFloat(totalJan) * fator, 2), fev: Math.round(parseFloat(totalFev) * fator, 2), mar: Math.round(parseFloat(totalMar) * fator, 2), abr: Math.round(parseFloat(totalAbr) * fator, 2), mai: Math.round(parseFloat(totalMai) * fator, 2), jun: Math.round(parseFloat(totalJun) * fator, 2),
                    jul: Math.round(parseFloat(totalJul) * fator, 2), ago: Math.round(parseFloat(totalAgo) * fator, 2), set: Math.round(parseFloat(totalSet) * fator, 2), out: Math.round(parseFloat(totalOut) * fator, 2), nov: Math.round(parseFloat(totalNov) * fator, 2), dez: Math.round(parseFloat(totalDez) * fator, 2), total: Math.round(total, 2)
                })
            } else {
                //console.log('req.body.add=>' + req.body.add)
                total = parseFloat(req.body.add) * 12
                uc.push({
                    seq: i + 1, jan: parseFloat(req.body.add), fev: parseFloat(req.body.add), mar: parseFloat(req.body.add), abr: parseFloat(req.body.add), mai: parseFloat(req.body.add), jun: parseFloat(req.body.add),
                    jul: parseFloat(req.body.add), ago: parseFloat(req.body.add), set: parseFloat(req.body.add), out: parseFloat(req.body.add), nov: parseFloat(req.body.add), dez: parseFloat(req.body.add), total
                })
            }
        }
        Projeto.findOneAndUpdate({ _id: id }, { $push: { uc: uc } }).then(() => {
            Projeto.findOne({ _id: id }).then((projeto) => {
                var add
                var novoadd
                if (naoVazio(req.body.add)) {
                    if (req.body.tipoadd == '%') {
                        novoadd = total - (total / fator / 12)
                    } else {
                        novoadd = req.body.add
                    }
                } else {
                    novoadd = 0
                }
                //console.log('novoadd=>' + novoadd)
                //console.log('projeto.adduc=>' + projeto.adduc)
                if (naoVazio(projeto.adduc)) {
                    add = projeto.adduc
                } else {
                    add = 0
                }
                //console.log('add=>' + add)
                projeto.adduc = parseFloat(add) + parseFloat(novoadd)
                projeto.save().then(() => {
                    req.flash('success_msg', 'Unidades consumidoras adicionadas com sucesso.')
                    res.redirect('/gerenciamento/fatura/' + req.body.id)
                }).catch((err) => {
                    req.flash('error_msg', 'Não foi possível salvar o projeto<uc_salvar>.')
                    res.redirect('/gerenciamento/fatura/' + req.body.id)
                })
            }).catch((err) => {
                req.flash('error_msg', 'Não foi possível encontrar o projeto<uc_findone_salvar>.')
                res.redirect('/gerenciamento/fatura/' + req.body.id)
            })
        }).catch((err) => {
            req.flash('error_msg', 'Não foi possível encontrar o projeto<uc>.')
            res.redirect('/dashboard')
        })
    } else {
        if (naoVazio(req.body.jan)) {
            jan = req.body.jan
        } else {
            jan = 0
        }
        if (naoVazio(req.body.fev)) {
            fev = req.body.fev
        } else {
            fev = 0
        }
        if (naoVazio(req.body.mar)) {
            mar = req.body.mar
        } else {
            mar = 0
        }
        if (naoVazio(req.body.abr)) {
            abr = req.body.abr
        } else {
            abr = 0
        }
        if (naoVazio(req.body.mai)) {
            mai = req.body.mai
        } else {
            mai = 0
        }
        if (naoVazio(req.body.jun)) {
            jun = req.body.jun
        } else {
            jun = 0
        }
        if (naoVazio(req.body.jul)) {
            jul = req.body.jul
        } else {
            jul = 0
        }
        if (naoVazio(req.body.ago)) {
            ago = req.body.ago
        } else {
            ago = 0
        }
        if (naoVazio(req.body.set)) {
            set = req.body.set
        } else {
            set = 0
        }
        if (naoVazio(req.body.out)) {
            out = req.body.out
        } else {
            out = 0
        }
        if (naoVazio(req.body.nov)) {
            nov = req.body.nov
        } else {
            nov = 0
        }
        if (naoVazio(req.body.dez)) {
            dez = req.body.dez
        } else {
            dez = 0
        }
        //console.log('iduc=>' + iduc)
        Projeto.findOneAndUpdate({ _id: id }, { $pull: { 'uc': { '_id': iduc } } }).then()
        //console.log('req.body.add=>' + req.body.add)
        //console.log('req.body.tipoadd=>' + req.body.tipoadd)
        if (naoVazio(req.body.add)) {
            if (req.body.tipoadd == '%') {
                fator = (1 + (req.body.add / 100))
                //console.log('fator=>' + fator)
                total = parseFloat(jan) + parseFloat(fev) + parseFloat(mar) + parseFloat(abr) + parseFloat(mai) + parseFloat(jun) +
                    parseFloat(jul) + parseFloat(ago) + parseFloat(set) + parseFloat(out) + parseFloat(nov) + parseFloat(dez)
                uc.push({
                    seq: 1, jan: parseFloat(jan), fev: parseFloat(fev), mar: parseFloat(mar), abr: parseFloat(abr), mai: parseFloat(mai), jun: parseFloat(jun),
                    jul: parseFloat(jul), ago: parseFloat(ago), set: parseFloat(set), out: parseFloat(out), nov: parseFloat(nov), dez: parseFloat(dez), total
                })
                total = Math.round((parseFloat(fev) * fator)) + Math.round((parseFloat(fev) * fator)) + Math.round((parseFloat(mar) * fator)) + Math.round((parseFloat(abr) * fator)) + Math.round((parseFloat(mai) * fator)) + Math.round((parseFloat(jun) * fator)) +
                    Math.round((parseFloat(jul) * fator)) + Math.round((parseFloat(ago) * fator)) + Math.round((parseFloat(set) * fator)) + Math.round((parseFloat(out) * fator)) + Math.round((parseFloat(nov) * fator)) + parseFloat(dez) * fator
                uc.push({
                    seq: 2, jan: Math.round(parseFloat(jan) * fator), fev: Math.round(parseFloat(fev) * fator), mar: Math.round(parseFloat(mar) * fator), abr: Math.round(parseFloat(abr) * fator), mai: Math.round(parseFloat(mai) * fator), jun: Math.round(parseFloat(jun) * fator),
                    jul: Math.round(parseFloat(jul) * fator), ago: Math.round(parseFloat(ago) * fator), set: Math.round(parseFloat(set) * fator), out: Math.round(parseFloat(out) * fator), nov: Math.round(parseFloat(nov) * fator), dez: Math.round(parseFloat(dez) * fator), total: Math.round(total, 2)
                })
            } else {
                //console.log('add=>' + add)
                total = parseFloat(jan) + parseFloat(fev) + parseFloat(mar) + parseFloat(abr) + parseFloat(mai) + parseFloat(jun) +
                    parseFloat(jul) + parseFloat(ago) + parseFloat(set) + parseFloat(out) + parseFloat(nov) + parseFloat(dez)
                //console.log('total=>' + total)
                uc.push({
                    seq: 1, jan: parseFloat(jan), fev: parseFloat(fev), mar: parseFloat(mar), abr: parseFloat(abr), mai: parseFloat(mai), jun: parseFloat(jun),
                    jul: parseFloat(jul), ago: parseFloat(ago), set: parseFloat(set), out: parseFloat(out), nov: parseFloat(nov), dez: parseFloat(dez), total
                })
                total = parseFloat(req.body.add) + parseFloat(req.body.add) + parseFloat(req.body.add) + parseFloat(req.body.add) + parseFloat(req.body.add) + parseFloat(req.body.add) +
                    parseFloat(req.body.add) + parseFloat(req.body.add) + parseFloat(req.body.add) + parseFloat(req.body.add) + parseFloat(req.body.add) + parseFloat(req.body.add)
                //console.log('total=>' + total)
                uc.push({
                    seq: 2, jan: parseFloat(req.body.add), fev: parseFloat(req.body.add), mar: parseFloat(req.body.add), abr: parseFloat(req.body.add), mai: parseFloat(req.body.add), jun: parseFloat(req.body.add),
                    jul: parseFloat(req.body.add), ago: parseFloat(req.body.add), set: parseFloat(req.body.add), out: parseFloat(req.body.add), nov: parseFloat(req.body.add), dez: parseFloat(req.body.add), total
                })
            }
        } else {
            total = parseFloat(req.body.jan) + parseFloat(req.body.fev) + parseFloat(req.body.mar) + parseFloat(req.body.abr) + parseFloat(req.body.mai) + parseFloat(req.body.jun) +
                parseFloat(req.body.jul) + parseFloat(req.body.ago) + parseFloat(req.body.set) + parseFloat(req.body.out) + parseFloat(req.body.nov) + parseFloat(req.body.dez)
            //console.log('total=>' + total)
            uc.push({
                seq: 1, jan: parseFloat(req.body.jan), fev: parseFloat(req.body.fev), mar: parseFloat(req.body.mar), abr: parseFloat(req.body.abr), mai: parseFloat(req.body.mai), jun: parseFloat(req.body.jun),
                jul: parseFloat(req.body.jul), ago: parseFloat(req.body.ago), set: parseFloat(req.body.set), out: parseFloat(req.body.out), nov: parseFloat(req.body.nov), dez: parseFloat(req.body.dez), total: Math.round(total, 2)
            })
        }

        Projeto.findOneAndUpdate({ _id: id }, { $push: { uc: uc } }).then(() => {
            Projeto.findOne({ _id: id }).then((projeto) => {
                var add
                var novoadd
                if (naoVazio(req.body.add)) {
                    if (req.body.tipoadd == '%') {
                        novoadd = total - (total / fator / 12)
                    } else {
                        novoadd = req.body.add
                    }
                } else {
                    novoadd = 0
                }
                //console.log('novoadd=>' + novoadd)
                //console.log('projeto.adduc=>' + projeto.adduc)
                if (naoVazio(projeto.adduc)) {
                    add = projeto.adduc
                } else {
                    add = 0
                }
                //console.log('add=>' + add)
                projeto.adduc = parseFloat(add) + parseFloat(novoadd)
                projeto.save().then(() => {
                    req.flash('success_msg', 'Unidades consumidoras adicionadas com sucesso.')
                    res.redirect('/gerenciamento/fatura/' + req.body.id)
                }).catch((err) => {
                    req.flash('error_msg', 'Não foi possível salvar o projeto<uc_salvar>.')
                    res.redirect('/gerenciamento/fatura/' + req.body.id)
                })
            }).catch((err) => {
                req.flash('error_msg', 'Não foi possível encontrar o projeto<uc_findone_salvar>.')
                res.redirect('/gerenciamento/fatura/' + req.body.id)
            })
        }).catch((err) => {
            req.flash('error_msg', 'Não foi possível encontrar o projeto<uc>.')
            res.redirect('/dashboard')
        })
    }
})

router.get('/deletauc/:id', ehAdmin, (req, res) => {
    var params = req.params.id
    params = params.split('@')
    //console.log('params[0]=>' + params[0])
    //console.log('params[1]=>' + params[1])
    Projeto.findOneAndUpdate({ _id: params[1] }, { $pull: { 'uc': { '_id': params[0] } } }).then(() => {
        req.flash('success_msg', 'Unidade consumidora excluída.')
        res.redirect('/gerenciamento/fatura/' + params[1])
    })
})

router.get('/fotos/:id', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    const { vendedor } = req.user
    const { funges } = req.user
    const { funpro } = req.user
    const { instalador } = req.user
    const { orcamentista } = req.user
    var id
    var proandges = false

    if (naoVazio(user)) {
        id = user
        ehMaster = false
    } else {
        id = _id
        ehMaster = true
    }

    Projeto.findOne({ _id: req.params.id }).lean().then((projeto) => {
        //console.log('projeto=>' + projeto)
        Cliente.findOne({ _id: projeto.cliente }).lean().then((cliente_projeto) => {
            let lista_proposta = projeto.proposta
            let lista_doc = []
            let lista_local = []
            let lista_entrada = []
            let lista_disjuntor = []
            let lista_trafo = []
            let lista_telhado = []
            let lista_localizacao = []
            let lista_medidor = []
            if (naoVazio(projeto.documento)) {
                lista_doc = listaFotos(projeto.documento)
            }
            // if (naoVazio(projeto.local)) {
            //     lista_local = listaFotos(projeto.local)
            // }
            if (naoVazio(projeto.entrada)) {
                lista_entrada = listaFotos(projeto.entrada)
            }               
            if (naoVazio(projeto.disjuntor)) {
                lista_disjuntor = listaFotos(projeto.disjuntor)
            }                                                
            if (naoVazio(projeto.trafo)) {
                lista_trafo = listaFotos(projeto.trafo)
            }
            if (naoVazio(projeto.telhado_foto)) {
                lista_telhado = listaFotos(projeto.telhado_foto)
            }
            if (naoVazio(projeto.localizacao)) {
                lista_localizacao = listaFotos(projeto.localizacao)
            }
            if (naoVazio(projeto.medidor)) {
                lista_medidor = listaFotos(projeto.medidor)
            }                        

            if (funges || funpro) {
                proandges = true
            } else {
                proandges = false
            }
            res.render('principal/fotos', {
                vendedor, orcamentista, funges, funpro, ehMaster, proandges, projeto, cliente_projeto,
                lista_doc, lista_entrada, lista_disjuntor, lista_trafo, lista_localizacao, lista_telhado, lista_medidor,
                seqdoc: lista_doc.length, seqent: lista_entrada.length, seqdis: lista_disjuntor.length, seqmed: lista_medidor.length,
                seqtra: lista_trafo.length, seqloc: lista_localizacao.length, seqtel: lista_telhado.length, lista_proposta
            })
        }).catch((err) => {
            req.flash('error_msg', 'Não foi possível encontrar o cliente da proposta<fotos>.')
            res.redirect('/dashboard')
        })
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar o projeto<fotos>.')
        res.redirect('/dashboard')
    })
})

router.get('/projeto/:id', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    const { vendedor } = req.user
    const { funges } = req.user
    const { funpro } = req.user
    const { instalador } = req.user
    const { orcamentista } = req.user
    var id
    var ehMaster = false

    var checkAuth
    var checkPay
    var dtfim

    var proandges = false
    if (funges || funpro) {
        proandges = true
    }

    if (typeof user == 'undefined') {
        id = _id
        ehMaster = true
    } else {
        id = user
        ehMaster = false
    }

    var checkPost = 'unchecked'
    var checkSoli = 'unchecked'
    var checkApro = 'unchecked'
    var checkTroca = 'unchecked'

    var lista_proposta = []

    Pessoa.find({ user: id, funins: 'checked' }).lean().then((instaladores) => {
        Projeto.findOne({ _id: req.params.id }).lean().then((projeto) => {

            //console.log('equipe=>'+equipe)
            if (projeto.autorizado) {
                checkAuth = 'checked'
            } else {
                checkAuth = 'unchecked'
            }
            lista_proposta = projeto.proposta

            //console.log('instalador=>' + instalador)
            Pedido.findOne({ _id: projeto.pedido }).lean().then((pedido) => {
                Cliente.findOne({ _id: projeto.cliente }).lean().then((cliente_projeto) => {
                    var dtfim = setData(pedido.data, pedido.prazo)
                    if (naoVazio(projeto.dataPost)) {
                        checkPost = 'checked'
                    }
                    if (naoVazio(projeto.dataSoli)) {
                        checkSoli = 'checked'
                    }
                    if (naoVazio(projeto.dataApro)) {
                        checkApro = 'checked'
                    }
                    if (naoVazio(projeto.dataTroca)) {
                        checkTroca = 'checked'
                    }
                    //console.log('lista_proposta=>' + lista_proposta)
                    res.render('principal/projeto', { checkAuth, checkPay, vendedor, lista_proposta, orcamentista, funpro, funges, ehMaster, proandges, pedido, projeto, instaladores, cliente_projeto, checkPost, checkSoli, checkApro, checkTroca, dtfim })
                }).catch((err) => {
                    req.flash('error_msg', 'Não foi possível encontrar o cliente da proposta<projeto>.')
                    res.redirect('/dashboard')
                })
            }).catch((err) => {
                req.flash('error_msg', 'Não foi possível encontrar o pedido<equipe>.')
                res.redirect('/dashboard')
            })


        }).catch((err) => {
            req.flash('error_msg', 'Não foi possível encontrar o projeto<projeto>.')
            res.redirect('/dashboard')
        })
    })
})

router.get('/checkAtv/:id', ehAdmin, (req, res) => {
    Tarefas.findOne({ _id: req.params.id }).then((tarefa) => {
        if (naoVazio(tarefa.dataini) == false) {
            tarefa.dataini = dataHoje()
        }
        //console.log('tarefa.emandamento=>'+tarefa.emandamento)
        if (naoVazio(tarefa.emandamento)) {
            if (tarefa.emandamento == true) {
                tarefa.emandamento = false
            } else {
                tarefa.emandamento = true
            }
        } else {
            //console.log('entrou')
            tarefa.emandamento = true
        }
        tarefa.save().then(() => {
            res.redirect('/gerenciamento/listaAtividade/' + tarefa.projeto)
        }).catch((err) => {
            req.flash('error_msg', 'Não foi possível salvar a tarefa.')
            res.redirect('/dashboard')
        })
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar a tarefa.')
        res.redirect('/dashboard')
    })
})

router.get('/instalacao/:id', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    const { vendedor } = req.user
    const { funges } = req.user
    const { funpro } = req.user
    const { orcamentista } = req.user

    var tarefas = []
    var check = false
    var contaDias = 0
    var entrega = true
    var termo = false
    var realizado = false
    var prjtermo
    var desctermo
    var dataini = '0000-00-00'
    var datafim = '0000-00-00'
    var ehMaster
    //console.log('req.params.id=>' + req.params.id)

    if (naoVazio(user)) {
        ehMaster = false
        id = user
    } else {
        ehMaster = true
        id = _id
    }

    if (funpro || funges) {
        proandges = true
    } else {
        proandges = false
    }

    Projeto.findOne({ _id: req.params.id }).lean().then((projeto) => {
        if (naoVazio(projeto.termo)) {
            termo = true
            prjtermo = projeto.termo
            desctermo = prjtermo[0].desc
        }
        Cliente.findOne({ _id: projeto.cliente }).lean().then((cliente_projeto) => {
            Tarefas.find({ projeto: req.params.id }).then((tarefa) => {
                //console.log('tarefa=>' + tarefa)
                if (naoVazio(tarefa)) {
                    tarefa.forEach((e) => {
                        //console.log('tarefas._id=>' + e._id)
                        if (e.concluido != true) {
                            entrega = false
                        }

                        if (naoVazio(e.dataini)) {
                            dataini = e.dataini
                            if (naoVazio(e.datafim)) {
                                datafim = e.datafim
                                contaDias = diferencaDias(e.dataini, e.datafim)
                            } else {
                                contaDias = diferencaDias(e.dataini, dataHoje())
                            }

                        } else {
                            contaDias = 0
                        }

                        if (naoVazio(e.fotos)) {
                            realizado = true
                        } else {
                            realizado = false
                        }

                        //console.log('dataini=>'+dataini)
                        //console.log('datafim=>'+datafim)

                        tarefas.push({ id: e._id, check, realizado, contaDias, descricao: e.descricao, dataini, datafim, concluido: e.concluido, emandamento: e.emandamento })
                    })
                    res.render('principal/instalacao', { desctermo, vendedor, orcamentista, funpro, proandges, funges, ehMaster, projeto, cliente_projeto, tarefas, entrega, termo })
                } else {
                    res.render('principal/instalacao', { desctermo, vendedor, orcamentista, funpro, proandges, funges, ehMaster, projeto, cliente_projeto, entrega, termo })
                }
            }).catch((err) => {
                req.flash('error_msg', 'Não foi possível encontrar as tarefas.')
                res.redirect('/dashboard')
            })
        }).catch((err) => {
            req.flash('error_msg', 'Não foi possível encontrar o cliente.')
            res.redirect('/dashboard')
        })
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar o projeto<instalacao>.')
        res.redirect('/dashboard')
    })
})

router.get('/verFotos/:id', ehAdmin, (req, res) => {
    var img = []
    var lista = []
    //console.log('req.params.id=>' + req.params.id)
    Tarefas.findOne({ _id: req.params.id }).lean().then((tarefas) => {
        img = tarefas.fotos
        img.forEach((i) => {
            //console.log('i.desc=>' + i.desc)
            lista.push({ id: tarefas._id, imagem: i.desc, atv: tarefas.desc })
        })
        res.render('principal/verfotos', { tarefas, idprj: tarefas.projeto, lista })
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar as tarefas.')
        res.redirect('/dashboard')
    })
})

router.get('/agenda/', ehAdmin, (req, res) => {

    const { _id } = req.user
    const { user } = req.user
    var id

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }

    var dia
    var hoje = dataHoje()
    var ano = hoje.substring(0, 4)
    var meshoje = hoje.substring(5, 7)

    if (meshoje < 10) {
        mes = '0' + meshoje
    }

    var mes
    var dif
    var difmes
    var dtinicio
    var dtfim
    var anoinicio
    var anofim
    var mesinicio
    var mesfim
    var diainicio
    var diafim

    var dataini = String(ano) + String(meshoje) + '01'
    var datafim = String(ano) + String(meshoje) + '31'

    var dia01 = []
    var dia02 = []
    var dia03 = []
    var dia04 = []
    var dia05 = []
    var dia06 = []
    var dia07 = []
    var dia08 = []
    var dia09 = []
    var dia10 = []
    var dia11 = []
    var dia12 = []
    var dia13 = []
    var dia14 = []
    var dia15 = []
    var dia16 = []
    var dia17 = []
    var dia18 = []
    var dia19 = []
    var dia20 = []
    var dia21 = []
    var dia22 = []
    var dia23 = []
    var dia24 = []
    var dia25 = []
    var dia26 = []
    var dia27 = []
    var dia28 = []
    var dia29 = []
    var dia30 = []
    var dia31 = []

    var janeiro = ''
    var fevereiro = ' '
    var marco = ''
    var abril = ''
    var maio = ''
    var junho = ''
    var julho = ''
    var agosto = ''
    var setembro = ''
    var outubro = ''
    var novembro = ''
    var dezembro = ''
    var mestitulo = ''

    var q = 0

    //console.log('meshoje=>' + meshoje)

    switch (String(meshoje)) {
        case '01': janeiro = 'active'
            mestitulo = 'Janeiro'
            break;
        case '02': fevereiro = 'active';
            mestitulo = 'Fevereiro'
            break;
        case '03': marco = 'active';
            mestitulo = 'Março'
            break;
        case '04': abril = 'active';
            mestitulo = 'Abril'
            break;
        case '05': maio = 'active';
            mestitulo = 'Maio'
            break;
        case '06': junho = 'active';
            mestitulo = 'Junho'
            break;
        case '07': julho = 'active';
            mestitulo = 'Julho'
            break;
        case '08': agosto = 'active';
            mestitulo = 'Agosto'
            break;
        case '09': setembro = 'active';
            mestitulo = 'Setembro'
            break;
        case '10': outubro = 'active';
            mestitulo = 'Outubro'
            break;
        case '11': novembro = 'active';
            mestitulo = 'Novembro'
            break;
        case '12': dezembro = 'active';
            mestitulo = 'Dezembro'
            break;
    }
    var sql
    //console.log('mestitulo=>' + mestitulo)
    // var nova_dataini = dataini
    Cliente.find({ user: id }).lean().then((todos_clientes) => {
        //console.log("dataini=>" + dataini)
        //console.log("datafim=>" + datafim)
        Tarefas.find({ user: id, servico: { $exists: true }, 'buscadataini': { $lte: parseFloat(datafim), $gte: parseFloat(dataini) } }).then((lista_tarefas) => {
            //console.log('lista_tarefas=>' + lista_tarefas)
            if (naoVazio(lista_tarefas)) {
                lista_tarefas.forEach((e) => {
                    //console.log('e._id=>' + e._id)
                    //console.log('e.cliente=>' + e.cliente)
                    Cliente.findOne({ _id: e.cliente }).then((cliente) => {
                        //console.log('cliente=>' + cliente)
                        Servico.findOne({ _id: e.servico }).then((ser) => {
                            var dias = []
                            var feito = false
                            // dias = e.dias
                            q++
                            dtinicio = e.dataini
                            // dtfim = e.datafim
                            anoinicio = dtinicio.substring(0, 4)
                            anofim = dtinicio.substring(0, 4)
                            mesinicio = dtinicio.substring(5, 7)
                            mesfim = dtinicio.substring(5, 7)
                            diainicio = dtinicio.substring(8, 11)
                            diafim = dtinicio.substring(8, 11)
                            //console.log("meshoje=>" + meshoje)
                            //console.log("mesinicio=>" + mesinicio)
                            if (naoVazio(e.programacao)) {
                                mes = mesinicio
                                dia = diainicio
                                dif = 1
                            } else {
                                if (meshoje == mesinicio) {
                                    mes = mesinicio
                                    if (anofim == anoinicio) {
                                        dia = diainicio
                                        dif = parseFloat(diafim) - parseFloat(diainicio) + 1
                                    } else {
                                        if (meshoje == 1 || meshoje == 3 || meshoje == 5 || meshoje == 7 || meshoje == 8 || meshoje == 10 || meshoje == 12) {
                                            dif = 31 - parseFloat(diainicio) + 1
                                        } else {
                                            dif = 30 - parseFloat(diainicio) + 1
                                        }
                                        if (diainicio < 10) {
                                            dia = '0' + parseFloat(diainicio)
                                        } else {
                                            dia = parseFloat(diainicio)
                                        }
                                    }
                                } else {
                                    //console.log('diferente')
                                    difmes = parseFloat(mesfim) - parseFloat(mesinicio)
                                    if (difmes != 0) {
                                        //console.log('difmes=>' + difmes)
                                        if (difmes < 0) {
                                            difmes = difmes + 12
                                        }
                                        //console.log('mesinicio=>' + mesinicio)
                                        for (i = 0; i < difmes; i++) {
                                            mes = parseFloat(mesinicio) + i
                                            if (mes > 12) {
                                                mes = mes - 12
                                            }
                                            //console.log('mes=>' + mes)
                                            //console.log('meshoje=>' + meshoje)
                                            if (mes == meshoje) {
                                                break;
                                            }
                                        }

                                        if (parseFloat(anofim) > parseFloat(anoinicio)) {
                                            dia = '01'
                                            if (meshoje == 1 || meshoje == 3 || meshoje == 5 || meshoje == 7 || meshoje == 8 || meshoje == 10 || meshoje == 12) {
                                                dif = 31
                                            } else {
                                                dif = 30
                                            }
                                        } else {
                                            dia = diainicio
                                            dif = parseFloat(diafim) - parseFloat(diainicio) + 1
                                        }
                                    }
                                }
                            }
                            const { dataini } = e
                            //console.log('dataini=>' + dataini)
                            //console.log('mes_busca=>' + mes_busca)
                            //console.log(' ser.descricao=>' + ser.descricao)
                            tarefa = ser.descricao
                            for (i = 0; i < dif; i++) {
                                //console.log('dia=>' + dia)
                                //console.log('entrou laço')
                                //console.log("meshoje=>" + meshoje)
                                //console.log("mes=>" + mes)
                                if (meshoje == mes) {
                                    //console.log("dias=>" + dias)
                                    // if (naoVazio(dias)) {
                                    //     //console.log('d=>' + d)
                                    //     feito = dias[i].feito
                                    //     //console.log('feito=>' + feito)
                                    // }
                                    cor = 'lightgray'
                                    sql = { cliente: cliente.nome, id: e._id, tarefa, cor, concluido: e.concluido }
                                    if (dia == '01') {
                                        dia01.push(sql)
                                    }
                                    if (dia == '02') {
                                        dia02.push(sql)
                                    }
                                    if (dia == '03') {
                                        dia03.push(sql)
                                    }
                                    if (dia == '04') {
                                        dia04.push(sql)
                                    }
                                    if (dia == '05') {
                                        dia05.push(sql)
                                    }
                                    if (dia == '06') {
                                        dia06.push(sql)
                                    }
                                    if (dia == '07') {
                                        dia07.push(sql)
                                    }
                                    if (dia == '08') {
                                        dia08.push(sql)
                                    }
                                    if (dia == '09') {
                                        dia09.push(sql)
                                    }
                                    if (dia == '10') {
                                        dia10.push(sql)
                                    }
                                    if (dia == '11') {
                                        dia11.push(sql)
                                    }
                                    if (dia == '12') {
                                        dia12.push(sql)
                                    }
                                    if (dia == '13') {
                                        dia13.push(sql)
                                    }
                                    if (dia == '14') {
                                        dia14.push(sql)
                                    }
                                    if (dia == '15') {
                                        dia15.push(sql)
                                    }
                                    if (dia == '16') {
                                        dia16.push(sql)
                                    }
                                    if (dia == '17') {
                                        dia17.push(sql)
                                    }
                                    if (dia == '18') {
                                        dia18.push(sql)
                                    }
                                    if (dia == '19') {
                                        dia19.push(sql)
                                    }
                                    if (dia == '20') {
                                        dia20.push(sql)
                                    }
                                    if (dia == '21') {
                                        dia21.push(sql)
                                    }
                                    if (dia == '22') {
                                        dia22.push(sql)
                                    }
                                    if (dia == '23') {
                                        dia23.push(sql)
                                    }
                                    if (dia == '24') {
                                        dia24.push(sql)
                                    }
                                    if (dia == '25') {
                                        dia25.push(sql)
                                    }
                                    if (dia == '26') {
                                        dia26.push(sql)
                                    }
                                    if (dia == '27') {
                                        dia27.push(sql)
                                    }
                                    if (dia == '28') {
                                        dia28.push(sql)
                                    }
                                    if (dia == '29') {
                                        dia29.push(sql)
                                    }
                                    if (dia == '30') {
                                        dia30.push(sql)
                                    }
                                    if (dia == '31') {
                                        dia31.push(sql)
                                    }
                                }
                                dia++
                            }
                            //console.log('q=>' + q)
                            //console.log('lista_tarefas.length=>' + lista_tarefas.length)
                            if (q == lista_tarefas.length) {
                                res.render('principal/agenda', {
                                    dia01, dia02, dia03, dia04, dia05, dia06, dia07,
                                    dia08, dia09, dia10, dia11, dia12, dia13, dia14,
                                    dia15, dia16, dia17, dia18, dia19, dia20, dia21,
                                    dia22, dia23, dia24, dia25, dia26, dia27, dia28,
                                    dia29, dia30, dia31, checkTesk: 'checked', checkInst: 'unchecked',
                                    mes, anotitulo: ano, todos_clientes, meshoje, mestitulo, janeiro, fevereiro, marco, abril, maio, junho,
                                    julho, agosto, setembro, outubro, novembro, dezembro, tarefas: true
                                })
                            }
                        })
                    })
                })
            } else {
                //console.log("q=>" + q)
                //console.log("lista_tarefas.length=>" + lista_tarefas.length)
                if (q == lista_tarefas.length) {
                    res.render('principal/agenda', {
                        dia01, dia02, dia03, dia04, dia05, dia06, dia07,
                        dia08, dia09, dia10, dia11, dia12, dia13, dia14,
                        dia15, dia16, dia17, dia18, dia19, dia20, dia21,
                        dia22, dia23, dia24, dia25, dia26, dia27, dia28,
                        dia29, dia30, dia31,
                        mes, anotitulo: ano, todos_clientes, mestitulo, meshoje, janeiro, fevereiro, marco, abril, maio, junho,
                        julho, agosto, setembro, outubro, novembro, dezembro, tarefas: true
                    })
                }
            }
        }).catch((err) => {
            req.flash('error_msg', 'Não foi possível encontrar o cliente.')
            res.redirect('/gerenciamento/agenda/')
        })
    })
})

router.get('/servicos/', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    var id

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }
    Servico.find({ user: id }).lean().then((servicos) => {
        res.render('principal/servicos', { servicos })
    }).catch((err) => {
        req.flash('error_msg', 'Falha ao encontrar os serviços.')
        res.redirect('/dashboard')
    })
})

router.get('/vermais/', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    var id

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }

    var dia01 = []
    var dia02 = []
    var dia03 = []
    var dia04 = []
    var dia05 = []
    var dia06 = []
    var dia07 = []
    var dia08 = []
    var dia09 = []
    var dia10 = []
    var dia11 = []
    var dia12 = []
    var dia13 = []
    var dia14 = []
    var dia15 = []
    var dia16 = []
    var dia17 = []
    var dia18 = []
    var dia19 = []
    var dia20 = []
    var dia21 = []
    var dia22 = []
    var dia23 = []
    var dia24 = []
    var dia25 = []
    var dia26 = []
    var dia27 = []
    var dia28 = []
    var dia29 = []
    var dia30 = []
    var dia31 = []
    var params_dia = []
    var todasCores = []

    const cores = ['green', 'blue', 'tomato', 'teal', 'sienna', 'salmon', 'mediumpurple', 'rebeccapurple', 'yellowgreen', 'peru', 'cadetblue', 'coral', 'cornflowerblue', 'crimson', 'darkblue', 'darkcyan', 'orange', 'hotpink']

    var dtcadastro = '00000000'
    var dtinicio = ''
    var q = 0
    var anoinicio
    var anofim
    var mesinicio
    var mesfim
    var diainicio
    var diafim
    var hoje
    var meshoje
    var mestitulo
    var anotitulo
    var dia
    var mes
    var dif
    var difmes
    var y = 0
    var x = -1
    var z = -1
    var inicio
    var fim
    var con1
    var con2
    var data1
    var data2
    var days
    var dif1

    var janeiro
    var fevereiro
    var marco
    var abril
    var maio
    var junho
    var julho
    var agosto
    var setembro
    var outubro
    var novembro
    var dezembro

    var hoje = dataHoje()
    var meshoje = hoje.substring(5, 7)
    var anotitulo = hoje.substring(0, 4)

    //console.log('meshoje=>' + meshoje)

    switch (meshoje) {
        case '01': janeiro = 'active'
            mestitulo = 'Janeiro '
            break;
        case '02': fevereiro = 'active'
            mestitulo = 'Fevereiro '
            break;
        case '03': marco = 'active'
            mestitulo = 'Março '
            break;
        case '04': abril = 'active'
            mestitulo = 'Abril '
            break;
        case '05': maio = 'active'
            mestitulo = 'Maio '
            break;
        case '06': junho = 'active'
            mestitulo = 'Junho '
            break;
        case '07': julho = 'active'
            mestitulo = 'Julho '
            break;
        case '08': agosto = 'active'
            mestitulo = 'Agosto '
            break;
        case '09': setembro = 'active'
            mestitulo = 'Setembro '
            break;
        case '10': outubro = 'active'
            mestitulo = 'Outubro '
            break;
        case '11': novembro = 'active'
            mestitulo = 'Novembro '
            break;
        case '12': dezembro = 'active'
            mestitulo = 'Dezembro '
            break;
    }
    dataini = String(anotitulo) + meshoje + '01'
    datafim = String(anotitulo) + meshoje + '30'
    dataini = parseFloat(dataini)
    datafim = parseFloat(datafim)
    //console.log('anotitulo=>' + anotitulo)
    //console.log('meshoje=>' + meshoje)
    //console.log('mestitulo=>' + mestitulo)
    //console.log('dataini=>' + dataini)
    //console.log('datafim=>' + datafim)
    var sql = {}
    sql = { user: id, feito: true, liberar: true, prjfeito: false, tarefa: { $exists: false }, nome_projeto: { $exists: true }, $or: [{ 'dtinibusca': { $lte: datafim, $gte: dataini } }, { 'dtfimbusca': { $lte: datafim, $gte: dataini } }] }
    Pessoa.find({ user: id, funins: 'checked' }).lean().then((pessoa) => {
        Equipe.find(sql).then((equipe) => {
            equipe.forEach((e) => {
                //console.log('e._id=>' + e._id)
                //console.log('e._id=>' + e.insres)
                Pessoa.findOne({ _id: e.insres }).then((tecnico) => {
                    q++
                    inicio = e.dtinicio
                    fim = e.dtfim
                    anoinicio = inicio.substring(0, 4)
                    anofim = fim.substring(0, 4)
                    mesinicio = inicio.substring(5, 7)
                    mesfim = fim.substring(5, 7)
                    diainicio = inicio.substring(8, 11)
                    diafim = fim.substring(8, 11)
                    con1 = String(mesinicio) + String(diainicio)
                    con2 = String(mesfim) + String(diafim)
                    dif1 = parseFloat(con2) - parseFloat(con1) + 1

                    if (meshoje == mesinicio) {
                        if (parseFloat(anotitulo) == parseFloat(anoinicio)) {
                            mes = meshoje
                            if (parseFloat(anofim) > parseFloat(anoinicio)) {
                                //console.log('projeto ultrapassa anos')
                                dia = diainicio
                                if (meshoje == 1 || meshoje == 3 || meshoje == 5 || meshoje == 7 || meshoje == 8 || meshoje == 10 || meshoje == 12) {
                                    dif = 31
                                } else {
                                    dif = 30
                                }
                            } else {
                                if (mesfim > mesinicio) {
                                    data1 = new Date(anofim + '-' + mesfim + '-' + '31')
                                    data2 = new Date(inicio)
                                    dif = Math.abs(data1.getTime() - data2.getTime())
                                    days = Math.ceil(dif / (1000 * 60 * 60 * 24))
                                    if (data1.getTime() < data2.getTime()) {
                                        days = days * -1
                                    }
                                    //console.log('days=>' + days)
                                    dia = diainicio
                                    dif = days + 1
                                } else {
                                    dia = diainicio
                                    dif = parseFloat(diafim) - parseFloat(diainicio) + 1
                                    //console.log('dia=>' + dia)
                                    //console.log('dif=>' + dif)
                                }
                            }
                        } else {
                            //console.log('anos diferente')
                            dia = 0
                            dif = 0
                        }
                    } else {
                        //console.log('diferente')
                        difmes = parseFloat(mesfim) - parseFloat(mesinicio) + 1
                        //console.log('difmes=>' + difmes)
                        if (difmes != 0) {
                            //console.log('difmes=>' + difmes)
                            if (difmes < 0) {
                                difmes = difmes + 12
                            }
                            //console.log('mesinicio=>' + mesinicio)
                            for (i = 0; i < difmes; i++) {
                                mes = parseFloat(mesinicio) + i
                                if (mes > 12) {
                                    mes = mes - 12
                                }
                                //console.log('mes=>' + mes)
                                //console.log('meshoje=>' + meshoje)
                                if (mes == meshoje) {
                                    if (mes < 10) {
                                        mes = '0' + mes
                                        dia = '01'
                                    }
                                    break;
                                }
                            }
                            if (anotitulo == anofim) {
                                if (mes == mesfim) {
                                    dif = parseFloat(diafim)
                                } else {
                                    if (meshoje == 1 || meshoje == 3 || meshoje == 5 || meshoje == 7 || meshoje == 8 || meshoje == 10 || meshoje == 12) {
                                        dif = 31
                                    } else {
                                        dif = 30
                                    }
                                }
                            } else {
                                dia = 0
                                dif = 0
                            }
                        } else {
                            dif = 0
                            dia = 0
                        }
                    }

                    //console.log('dif=>' + dif)
                    //console.log('dia=>' + dia)
                    //console.log('mes=>' + mes)
                    y = Math.floor(Math.random() * 17)
                    if (y == x) {
                        y = Math.floor(Math.random() * 17)
                    } else {
                        if (y == z) {
                            y = Math.floor(Math.random() * 17)
                        }
                    }
                    x = y
                    z = y

                    color = cores[y]
                    //console.log('color=>' + color)
                    todasCores.push({ color })

                    for (i = 0; i < dif; i++) {
                        //console.log('dia=>' + dia)
                        //console.log('entrou laço')    
                        params_dia = { id: tecnico._id, tecnico: tecnico.nome, cor: color, instalador: 'true' }
                        if (meshoje == mes) {
                            switch (String(dia)) {
                                case '01':
                                    dia01.push(params_dia)
                                    break;
                                case '02':
                                    dia02.push(params_dia)
                                    break;
                                case '03':
                                    dia03.push(params_dia)
                                    break;
                                case '04':
                                    dia04.push(params_dia)
                                    break;
                                case '05':
                                    dia05.push(params_dia)
                                    break;
                                case '06':
                                    dia06.push(params_dia)
                                    break;
                                case '07':
                                    dia07.push(params_dia)
                                    break;
                                case '08':
                                    dia08.push(params_dia)
                                    break;
                                case '09':
                                    dia09.push(params_dia)
                                    break;
                                case '10':
                                    dia10.push(params_dia)
                                    break;
                                case '11':
                                    dia11.push(params_dia)
                                    break;
                                case '12':
                                    dia12.push(params_dia)
                                    break;
                                case '13':
                                    dia13.push(params_dia)
                                    break;
                                case '14':
                                    dia14.push(params_dia)
                                    break;
                                case '15':
                                    dia15.push(params_dia)
                                    break;
                                case '16':
                                    dia16.push(params_dia)
                                    break;
                                case '17':
                                    dia17.push(params_dia)
                                    break;
                                case '18':
                                    dia18.push(params_dia)
                                    break;
                                case '19':
                                    dia19.push(params_dia)
                                    break;
                                case '20':
                                    dia20.push(params_dia)
                                    break;
                                case '21':
                                    dia21.push(params_dia)
                                    break;
                                case '22':
                                    dia22.push(params_dia)
                                    break;
                                case '23':
                                    dia23.push(params_dia)
                                    break;
                                case '24':
                                    dia24.push(params_dia)
                                    break;
                                case '25':
                                    dia25.push(params_dia)
                                    break;
                                case '26':
                                    dia26.push(params_dia)
                                    break;
                                case '27':
                                    dia27.push(params_dia)
                                    break;
                                case '28':
                                    dia28.push(params_dia)
                                    break;
                                case '29':
                                    dia29.push(params_dia)
                                    break;
                                case '30':
                                    dia30.push(params_dia)
                                    break;
                                case '31':
                                    dia31.push(params_dia)
                                    break;
                            }
                            dia++
                            if (dia < 10) {
                                dia = '0' + dia
                            }
                            //console.log('dia=>' + dia)
                        }
                    }
                    //console.log('q=>' + q)
                    if (q == equipe.length) {
                        res.render('principal/agenda', {
                            dia01, dia02, dia03, dia04, dia05, dia06, dia07, dia08, dia09, dia10,
                            dia11, dia12, dia13, dia14, dia15, dia16, dia17, dia18, dia19, dia20,
                            dia21, dia22, dia23, dia24, dia25, dia26, dia27, dia28, dia29, dia30, dia31, pessoa,
                            mestitulo, meshoje, anotitulo, todasCores, dataini, datafim, ehinstalador: true,
                            janeiro, fevereiro, marco, abril, maio, junho, julho, agosto, setembro, outubro, novembro, dezembro
                        })
                    }
                }).catch((err) => {
                    req.flash('error_msg', 'Falha ao encontra o instalador.')
                    res.redirect('/dashboard')
                })
            })
        }).catch((err) => {
            req.flash('error_msg', 'Falha ao encontra a equipe.')
            res.redirect('/dashboard')
        })
    }).catch((err) => {
        req.flash('error_msg', 'Falha ao encontra a pessoa.')
        res.redirect('/dashboard')
    })
})

router.get('/atividadesPadrao', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    var id

    if (typeof user == 'undefined') {
        id = _id
    }
    AtvPadrao.find({ user: id }).lean().then((atv) => {
        res.render('principal/atividadesPadrao', { atv })
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar as atividades padrão.')
        res.redirect('/gerenciamento/atividadesPadrao/')
    })
})

router.get('/delAtvPadrao/:id', ehAdmin, (req, res) => {
    AtvPadrao.findOneAndDelete({ _id: req.params.id }).then(() => {
        req.flash('success_msg', 'Atividade padrão removida.')
        res.redirect('/gerenciamento/atividadesPadrao')
    }).catch((err) => {
        req.flash('error_msg', 'Falha ao encontrar as atividades padrão.')
        res.redirect('/gerenciamento/atividadesPadrao')
    })
})

router.get('/plano', ehAdmin, (req, res) => {
    res.render('projeto/gerenciamento/planos')
})

router.get('/plano/:id', ehAdmin, (req, res) => {
    Plano.findOne({ _id: req.params.id }).lean().then((plano) => {
        res.render('projeto/gerenciamento/planos', { plano })
    }).catch((err) => {
        req.flash('error_msg', 'Falha ao encontrar o plano.')
        res.redirect('/gerenciamento/agenda')
    })
})

router.get('/seleciona/:id', ehAdmin, (req, res) => {
    Projeto.findOne({ _id: req.params.id }).then((projeto) => {
        Equipe.findOne({ _id: projeto.equipe }).then((equipe) => {
            if (equipe.ativo == true) {
                equipe.ativo = false
                equipe.save().then(() => {
                    res.redirect('/dashboard')
                })
            } else {
                equipe.ativo = true
                equipe.save().then(() => {
                    res.redirect('/dashboard')
                })
            }

        })
    }).catch((err) => {
        req.flash('error_msg', 'Falha ao encontrar o projeto.')
        res.redirect('/dashboard')
    })
})

router.get('/seltarefa/:id', ehAdmin, (req, res) => {
    Tarefas.findOne({ _id: req.params.id }).then((tarefa) => {
        if (tarefa.selecionado) {
            tarefa.selecionado = false
        } else {
            tarefa.selecionado = true
        }
        tarefa.save().then(() => {
            res.redirect('/gerenciamento/assistencia')
        }).catch((err) => {
            req.flash('error_msg', 'Falha ao salvar a tarefa.')
            res.redirect('/gerenciamento/assistencia')
        })
    }).catch((err) => {
        req.flash('error_msg', 'Falha ao encontrar o projeto.')
        res.redirect('/gerenciamento/assistencia')
    })
})

router.get('/listaAtividade/:id', ehAdmin, (req, res) => {
    var check
    var tarefas = []
    var checkAtv = false
    Projeto.findOne({ _id: req.params.id }).lean().then((projeto) => {
        Equipe.findOne({ _id: projeto.equipe }).lean().then((equipe) => {
            Cliente.findOne({ _id: projeto.cliente }).lean().then((cliente_projeto) => {
                Tarefas.find({ projeto: req.params.id }).lean().then((tarefa) => {
                    tarefa.forEach((e) => {
                        if (e.emandamento == true || typeof e.emadanmento != 'undefined') {
                            check = 'checked'
                            checkAtv = true
                        } else {
                            check = 'unchecked'
                            checkAtv = false
                        }
                        tarefas.push({ id: e._id, descricao: e.descricao, check, checkAtv })
                    })

                    res.render('principal/instalacao', { vendedor: false, orcamentista: false, instalador: true, id: req.params.id, projeto, equipe, cliente_projeto, tarefas })

                }).catch((err) => {
                    req.flash('error_msg', 'Falha ao encontrar as tarefas.')
                    res.redirect('/dashboard')
                })
            }).catch((err) => {
                req.flash('error_msg', 'Falha ao encontrar o cliente.')
                res.redirect('/dashboard')
            })
        }).catch((err) => {
            req.flash('error_msg', 'Falha ao encontrar a equipe.')
            res.redirect('/dashboard')
        })
    }).catch((err) => {
        req.flash('error_msg', 'Falha ao encontrar o projeto.')
        res.redirect('/dashboard')
    })
})

router.get('/consultaplano', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    var id

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }
    Plano.find({ user: id }).lean().then((planos) => {
        res.render('projeto/gerenciamento/consultaplano', { planos })
    }).catch((err) => {
        req.flash('error_msg', 'Falha ao encontrar o plano.')
        res.redirect('/gerenciamento/plano')
    })
})

router.get('/orcamento/:id', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    const { vendedor } = req.user
    const { funges } = req.user
    const { funpro } = req.user
    const { pessoa } = req.user
    const { orcamentista } = req.user
    var proandges = false
    var ehMaster = false

    var id
    if (naoVazio(user)) {
        id = user
        ehMaster = false
    } else {
        id = _id
        ehMaster = true
    }

    var lista_proposta = []
    var lista_obs = ''
    var check30 = 'unchecked'
    var check45 = 'unchecked'
    var check60 = 'unchecked'
    var idAcesso
    var ultima_proposta
    var descricao = ''
    var nome_cliente = ''
    var aux = ''
    var lista_itens = []
    var lista_params = []
    var options = ''
    var selectini = ''
    var selectfim = ''
    var campo = ''
    var tipo = ''
    var dados = []
    var x = 0
    var vrlServico = 0
    var desctermo = ''
    var vistoria = false
    var termo = ''

    var lancarPedido = false
    if (orcamentista || funges || naoVazio(user) == false) {
        lancarPedido = true
    }

    if (funges || funpro) {
        proandges = true
    } else {
        proandges = false
    }

    Empresa.findOne({ user: id }).lean().then((empresa) => {
        //console.log('vendedor=>' + vendedor)
        //console.log('funges=>' + funges)
        //console.log('orcamentista=>' + orcamentista)
        Projeto.findOne({ _id: req.params.id }).lean().then((projeto) => {
            Pedido.findOne({ _id: projeto.pedido }).lean().then((pedido) => {
                dados = projeto.params

                //console.log('dados=>'+JSON.stringify(dados))
                //console.log('solar=>' + projeto.solar)
                if (projeto.ampliacao) {
                    tipo = 'ampliacao'
                } else {
                    tipo = 'novo'
                }

                lista_proposta = projeto.proposta
                lista_proposta.forEach((e) => {
                    if (naoVazio(e.obs)) {
                        lista_obs = lista_obs + e.obs + '\n'
                    }
                })
                if (naoVazio(lista_proposta)) {
                    ultima_proposta = lista_proposta[lista_proposta.length - 1]
                    descricao = ultima_proposta.arquivo
                }

                if (projeto.prazo == 30) {
                    check30 = 'checked'
                } else {
                    if (projeto.prazo = 45) {
                        check45 = 'checked'
                    } else {
                        check60 = 'checked'
                    }
                }

                if (projeto.plaQtdMod) {
                    vlrServico = parseFloat(projeto.plaQtdMod) * empresa.vlrmdo
                } else {
                    vlrServico = '0,00'
                }
                var vlrKit = parseFloat(projeto.valor) - parseFloat(vlrServico)
                //console.log('vrlKit=>' + vlrKit)

                Cliente.findOne({ _id: projeto.cliente }).lean().then((cliente_projeto) => {
                    Pessoa.findOne({ _id: projeto.vendedor }).lean().then((ven_projeto) => {
                        Agenda.findOne({ cliente: projeto.cliente }).lean().then((agenda) => {
                            Componente.find({ user: id, classificacao: 'solar' }).lean().then((equipamento) => {
                                Parametros.find({ user: id, tipo: 'solar' }).then((parametros) => {
                                    //console.log('dados=>' + dados)
                                    parametros.forEach((e) => {
                                        if (naoVazio(e.valor)) {
                                            valor = e.valor.split(';')
                                            if (valor.length > 1) {
                                                selectini = '<select name="params[]" class="form-select form-select-sm mb-1">'
                                                selectfim = '</select>'
                                                for (let i = 0; i < valor.length; i++) {
                                                    //console.log('i=>'+i)
                                                    //console.log('valor=>'+valor[i])
                                                    options = options + '<option value="' + valor[i] + '">' + valor[i] + '</option>'
                                                }
                                                //console.log('dados=>' + dados[x].descricao)
                                                //console.log('valor=>' + e.descricao)
                                                if (dados[x].descricao == e.descricao) {
                                                    options = '<option class="fw-bold" value="' + dados[x].valor + '">' + dados[x].valor + '</option>' + options
                                                }
                                                campo = selectini + options + selectfim
                                            } else {
                                                //console.log('input type text')
                                                if (naoVazio(dados)) {
                                                    campo = '<input type="text" class="form-control form-control-sm mb-1" name="params[]" value="' + dados[x].valor + '">'
                                                } else {
                                                    campo = '<input type="text" class="form-control form-control-sm mb-1" name="params[]" value="">'
                                                }
                                            }
                                        } else {
                                            //console.log('input type text vazio')
                                            //console.log('dados=>' + dados)
                                            if (naoVazio(dados)) {
                                                campo = '<input type="text" class="form-control form-control-sm mb-1" name="params[]" value="' + dados[x].valor + '">'
                                            } else {
                                                campo = '<input type="text" class="form-control form-control-sm mb-1" name="params[]" value="">'
                                            }
                                        }
                                        lista_itens.push({ desc: e.descricao })
                                        //console.log('campo=>' + campo)
                                        //console.log('descricao=>' + e.descricao)
                                        lista_params.push({ id: e._id, descricao: e.descricao, campo })
                                        campo = ''
                                        options = ''
                                        x++
                                    })
                                    //console.log('lista_params=>' + lista_params)
                                    if (vendedor == true && funges == false && orcamentista == false && funpro == false) {
                                        //console.log('req.params.id=>' + req.params.id)
                                        //console.log('ven_projeto._id=>'+ven_projeto._id)
                                        //console.log('lista_obs=>' + lista_obs)
                                        if (naoVazio(projeto.dataPost) && naoVazio(projeto.dataSoli) && naoVazio(projeto.dataApro)) {
                                            vistoria = true
                                            termo = projeto.termo
                                            if (naoVazio(termo)) {
                                                desctermo = termo[0].desc
                                            }
                                        }
                                        if (naoVazio(projeto.responsavel)) {
                                            //console.log('entrou responsavel')
                                            Pessoa.findOne({ _id: projeto.responsavel }).lean().then((responsavel) => {
                                                //console.log('lista_params=>' + JSON.stringify(lista_params))
                                                if (naoVazio(agenda)) {
                                                    res.render('principal/orcamento', { tipo, pedido, vlrKit, vlrServico, vlrMascaraServico: mascaraDecimal(vlrServico), check30, check45, check60, responsavel, equipamento, vistoria, lista_itens, lista_params, desctermo, agenda, empresa, descricao, vendedor, cliente_projeto, ven_projeto, projeto, idAcesso: _id, lista_proposta, lista_obs })
                                                } else {
                                                    res.render('principal/orcamento', { tipo, pedido, vlrKit, vlrServico, vlrMascaraServico: mascaraDecimal(vlrServico), check30, check45, check60, responsavel, equipamento, vistoria, lista_itens, lista_params, desctermo, empresa, descricao, vendedor, cliente_projeto, ven_projeto, projeto, idAcesso: _id, lista_proposta, lista_obs })
                                                }

                                            }).catch((err) => {
                                                req.flash('error_msg', 'Não foi possível encontrar o responsável do projeto.')
                                                res.redirect('/dashboard')
                                            })
                                        } else {
                                            if (naoVazio(agenda)) {
                                                res.render('principal/orcamento', { tipo, pedido, vlrKit, vlrServico, vlrMascaraServico: mascaraDecimal(vlrServico), check30, check45, check60, equipamento, vistoria, lista_itens, lista_params, desctermo, agenda, empresa, descricao, vendedor, cliente_projeto, ven_projeto, projeto, idAcesso: _id, lista_proposta, lista_obs })
                                            } else {
                                                res.render('principal/orcamento', { tipo, pedido, vlrKit, vlrServico, vlrMascaraServico: mascaraDecimal(vlrServico), check30, check45, check60, equipamento, vistoria, lista_itens, lista_params, desctermo, empresa, descricao, vendedor, cliente_projeto, ven_projeto, projeto, idAcesso: _id, lista_proposta, lista_obs })
                                            }
                                        }
                                    } else {
                                        //console.log('lista_proposta=>' + projeto.proposta)
                                        //console.log("descricao=>"+descricao)
                                        Pessoa.find({ user: id, vendedor: 'checked' }).lean().then((todos_vendedores) => {
                                            // Equipe.findOne({ _id: projeto.equipe }).lean().then((lista_equipe) => {
                                            //console.log('projeto.pedido=>' + projeto.pedido)
                                            //console.log("sem pedido")
                                            //console.log('projeto.termo=>' + projeto.termo)
                                            termo = projeto.termo
                                            if (naoVazio(termo)) {
                                                desctermo = termo[0].desc
                                            }
                                            //console.log("desctermo=>" + desctermo)
                                            aux = cliente_projeto.nome
                                            aux = aux.split(' ')
                                            for (let i = 0; i < aux.length; i++) {
                                                nome_cliente = nome_cliente + aux[i]
                                            }
                                            if (naoVazio(projeto.responsavel)) {
                                                //console.log('entrou responsavel')
                                                Pessoa.findOne({ _id: projeto.responsavel }).lean().then((responsavel) => {
                                                    if (naoVazio(agenda)) {
                                                        res.render('principal/orcamento', { tipo, pedido, desctermo, vlrKit, vlrServico, vlrMascaraServico: mascaraDecimal(vlrServico), check30, check45, check60, equipamento, agenda, lista_params, lista_itens, empresa, descricao, orcamentista, vendedor, lancarPedido, funpro, funges, ehMaster, proandges, cliente_projeto, nome_cliente, responsavel, todos_vendedores, ven_projeto, projeto, idAcesso: id, lista_proposta, lista_obs })
                                                    } else {
                                                        res.render('principal/orcamento', { tipo, pedido, desctermo, vlrKit, vlrServico, vlrMascaraServico: mascaraDecimal(vlrServico), check30, check45, check60, equipamento, lista_params, lista_itens, empresa, descricao, orcamentista, vendedor, funpro, lancarPedido, funges, ehMaster, proandges, cliente_projeto, nome_cliente, responsavel, todos_vendedores, ven_projeto, projeto, idAcesso: id, lista_proposta, lista_obs })
                                                    }
                                                    //console.log('projeto.cliente=>' + projeto.cliente)
                                                }).catch((err) => {
                                                    req.flash('error_msg', 'Não foi possível encontrar o responsável do projeto.')
                                                    res.redirect('/dashboard')
                                                })
                                            } else {
                                                //console.log('orcamentista=>' + orcamentista)
                                                //console.log('orcamentista=>' + orcamentista)
                                                //console.log('pessoa=>' + pessoa)
                                                if (funges == true || orcamentista == true || funpro == true) {
                                                    //console.log('pessoa=>' + pessoa._id)
                                                    Projeto.findOneAndUpdate({ _id: req.params.id }, { $set: { 'responsavel': pessoa } }).then(() => {
                                                        //console.log('update=>')
                                                        if (naoVazio(agenda)) {
                                                            res.render('principal/orcamento', { tipo, pedido, desctermo, vlrKit, vlrServico, vlrMascaraServico: mascaraDecimal(vlrServico), check30, check45, check60, equipamento, agenda, lista_params, lista_itens, empresa, descricao, orcamentista, lancarPedido, funpro, funges, ehMaster, proandges, cliente_projeto, nome_cliente, todos_vendedores, ven_projeto, projeto, idAcesso: id, lista_proposta, lista_obs })
                                                        } else {
                                                            res.render('principal/orcamento', { tipo, pedido, desctermo, vlrKit, vlrServico, vlrMascaraServico: mascaraDecimal(vlrServico), check30, check45, check60, equipamento, lista_params, lista_itens, empresa, descricao, orcamentista, funpro, lancarPedido, funges, ehMaster, proandges, cliente_projeto, nome_cliente, todos_vendedores, ven_projeto, projeto, idAcesso: id, lista_proposta, lista_obs })
                                                        }
                                                    })
                                                } else {
                                                    if (naoVazio(agenda)) {
                                                        res.render('principal/orcamento', { tipo, pedido, desctermo, vlrKit, vlrServico, vlrMascaraServico: mascaraDecimal(vlrServico), check30, check45, check60, equipamento, agenda, lista_params, lista_itens, empresa, descricao, lancarPedido, funges, ehMaster, proandges, cliente_projeto, nome_cliente, todos_vendedores, ven_projeto, projeto, idAcesso: id, lista_proposta })
                                                    } else {
                                                        res.render('principal/orcamento', { tipo, pedido, desctermo, vlrKit, vlrServico, vlrMascaraServico: mascaraDecimal(vlrServico), check30, check45, check60, equipamento, empresa, lista_params, lista_itens, descricao, lancarPedido, funges, ehMaster, proandges, cliente_projeto, nome_cliente, todos_vendedores, ven_projeto, projeto, idAcesso: id, lista_proposta })
                                                    }
                                                }
                                            }
                                        }).catch((err) => {
                                            req.flash('error_msg', 'Não foi possível encontrar o responsável.')
                                            res.redirect('/dashboard')
                                        })
                                    }
                                }).catch((err) => {
                                    req.flash('error_msg', 'Não foi possível encontrar os parâmetros.')
                                    res.redirect('/dashboard')
                                })
                            }).catch((err) => {
                                req.flash('error_msg', 'Não foi possível encontrar os componentes.')
                                res.redirect('/dashboard')
                            })
                        }).catch((err) => {
                            req.flash('error_msg', 'Não foi possível encontrar a agenda do cliente.')
                            res.redirect('/dashboard')
                        })
                    }).catch((err) => {
                        req.flash('error_msg', 'Não foi possível encontrar o responsável do projeto.')
                        res.redirect('/dashboard')
                    })
                }).catch((err) => {
                    req.flash('error_msg', 'Não foi possível encontrar o cliente da proposta<orcamento master>.')
                    res.redirect('/dashboard')
                })
            }).catch((err) => {
                req.flash('error_msg', 'Não foi possível encontrar o pedido.')
                res.redirect('/dashboard')
            })
        }).catch((err) => {
            req.flash('error_msg', 'Não foi possível encontrar o projeto.')
            res.redirect('/dashboard')
        })
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar a empresa.')
        res.redirect('/dashboard')
    })
})

router.post('/proposta', upload.single('proposta'), ehAdmin, (req, res) => {
    var file
    //console.log('req.file=>' + req.file)
    if (req.file != null) {
        file = req.file.originalname
    } else {
        file = ''
    }
    var proposta = []
    //console.log('file=>' + file)
    Projeto.findOne({ _id: req.body.id }).then((projeto) => {
        var propostas = []
        propostas = projeto.proposta
        var x = propostas.length
        //console.log("x=>" + x)
        if (naoVazio(x)) {
            var ultimo = propostas[x - 1]
            var seq = parseFloat(ultimo.seq) + 1
        } else {
            seq = 1
        }

        //console.log('file=>' + file)
        //console.log('req.body.dtcadastro=>' + req.body.dtcadastro)
        //console.log('req.body.dtvalidade =>' + req.body.dtvalidade)
        proposta = { seq, arquivo: req.body.seq + '_' + file, data: dataMensagem(req.body.dtcadastro), validade: dataMensagem(req.body.dtvalidade) }
        //console.log('id=>' + req.body.id)
        //console.log('projeto.vendedor=>' + projeto.vendedor)
        Cliente.findOne({ _id: projeto.cliente }).then((cliente) => {
            Pessoa.findOne({ _id: projeto.vendedor, notpro: 'checked' }).then((vendedor) => {
                //console.log('projeto.responsavel=>' + projeto.responsavel)
                if (naoVazio(projeto.responsavel)) {
                    Pessoa.findOne({ _id: projeto.responsavel }).then((responsavel) => {
                        Projeto.findOneAndUpdate({ _id: req.body.id }, { $push: { proposta: proposta } }).then((e) => {
                            if (naoVazio(vendedor)) {
                                var texto = 'Olá ' + vendedor.nome + ',' + '\n' +
                                    'Uma nova proposta do projeto ' + projeto.seq + ' para o cliente ' + cliente.nome + ' foi adicionada por: ' + responsavel.nome + ' dia ' + dataMensagem(dataHoje()) + '.' + '\n' +
                                    'Acesse e acompanhe https://quasat.vimmus.com.br/gerenciamento/orcamento/' + projeto._id + '.'

                                //console.log('vendedor.celular=>' + vendedor.celular)

                                client.messages
                                    .create({
                                        body: texto,
                                        from: 'whatsapp:+554991832978',
                                        to: 'whatsapp:+55' + vendedor.celular
                                    })
                                    .then((message) => {
                                        //console.log(message.sid)
                                        req.flash('success_msg', 'Proposta adicionada com sucesso')
                                        res.redirect('/gerenciamento/orcamento/' + req.body.id)

                                    }).done()
                            } else {
                                req.flash('success_msg', 'Proposta adicionada com sucesso')
                                res.redirect('/gerenciamento/orcamento/' + req.body.id)
                            }
                        }).catch((err) => {
                            req.flash('error_msg', 'Houve erro ao salvar a proposta.')
                            res.redirect('/gerenciamento/orcamento/' + req.body.id)
                        })
                    }).catch((err) => {
                        req.flash('error_msg', 'Houve erro ao econtrar o vendedor.')
                        res.redirect('/gerenciamento/orcamento/' + req.body.id)
                    })
                } else {
                    //console.log("entrou como gestor")
                    Projeto.findOneAndUpdate({ _id: req.body.id }, { $push: { proposta: proposta } }).then((e) => {
                        req.flash('aviso_msg', 'Nenhum orçamentista será avisado sobre o upload da proposta. Solicite à um orçamentista para gerenciar esta proposta.')
                        res.redirect('/gerenciamento/orcamento/' + req.body.id)
                    }).catch((err) => {
                        req.flash('error_msg', 'Houve erro ao salvar a proposta.')
                        res.redirect('/gerenciamento/orcamento/' + req.body.id)
                    })
                }
            }).catch((err) => {
                req.flash('error_msg', 'Houve erro ao econtrar o vendedor.')
                res.redirect('/gerenciamento/orcamento/' + req.body.id)
            })
        }).catch((err) => {
            req.flash('error_msg', 'Houve erro ao encontrar o cliente.')
            res.redirect('/gerenciamento/orcamento/' + req.body.id)
        })
    }).catch((err) => {
        req.flash('error_msg', 'Houve erro ao encontrar o projeto.')
        res.redirect('/gerenciamento/orcamento/' + req.body.id)
    })
})

router.get('/deletarProposta/:id', ehAdmin, (req, res) => {
    var params = req.params.id
    params = params.split('@')
    //console.log('params[0]=>' + params[0])
    //console.log('params[1]=>' + params[1])
    Projeto.findOneAndUpdate({ 'proposta._id': params[0] }, { $pull: { 'proposta': { '_id': params[0] } } }).then(() => {
        req.flash('success_msg', 'Proposta removida com sucesso.')
        res.redirect('/gerenciamento/orcamento/' + params[1])
    }).catch((err) => {
        req.flash('error_msg', 'Houve erro ao excluir a proposta.')
        res.redirect('/gerenciamento/orcamento/' + params[1])
    })
})

router.get('/ganho/:id', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    var id
    var q = 0
    var s = 0
    var texto = ''
    var tarefa

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }

    Projeto.findOne({ _id: req.params.id }).then((projeto) => {
        Cliente.findOne({ _id: projeto.cliente }).then((cliente) => {
            projeto.ganho = true
            projeto.status = 'Ganho'
            projeto.datastatus = dataHoje()
            const corpo = {
                user: id,
                nome_projeto: cliente.nome,
                liberar: false,
                prjfeito: false,
                feito: true,
                parado: false,
                projeto: req.params.id,
                dtinicio: dataHoje(),
                dtfim: dataHoje(),
                dtinibusca: dataBusca(dataHoje()),
                dtfimbusca: dataBusca(dataHoje())
            }
            new Equipe(corpo).save().then(() => {
                Equipe.findOne({ user: id }).sort({ field: 'asc', _id: -1 }).then((equipe) => {
                    projeto.save().then(() => {
                        //console.log('novaatv=>' + novaatv)
                        // new AtvTelhado(corpo).save().then(() => {
                        //     new AtvAterramento(corpo).save().then(() => {
                        //         new AtvInversor(corpo).save().then(() => {
                        AtvPadrao.find({ user: id }).then((atv) => {
                            atv.forEach((e) => {
                                //console.log('e=>' + e.descricao)
                                s++
                                tarefa = {
                                    user: id,
                                    projeto: req.params.id,
                                    descricao: e.descricao,
                                    equipe: equipe,
                                    seq: s,
                                    tipo: 'padrao',
                                    emandamento: false
                                }
                                //console.log('tarefa=>' + tarefa)
                                new Tarefas(tarefa).save().then(() => {
                                    //console.log('q=>' + q)
                                    q++
                                    if (q == atv.length) {
                                        q = 0
                                        Acesso.find({ user: id, notgan: 'checked' }).then((acesso) => {
                                            //console.log('acesso=>' + acesso)
                                            if (naoVazio(acesso)) {
                                                acesso.forEach((e) => {
                                                    Pessoa.findOne({ _id: e.pessoa }).then((pessoa) => {
                                                        //console.log('pessoa=>' + pessoa)
                                                        texto = 'Olá ' + pessoa.nome + ',' + '\n' +
                                                            'PROPOSTA GANHA!' + '\n' +
                                                            'A proposta ' + projeto.seq + ' do cliente ' + cliente.nome + ' esta ganha. ' + '\n ' +
                                                            'Acesse https://quasat.vimmus.com.br/gerenciamento/orcamento/' + projeto._id + ' e acompanhe.'

                                                        //console.log('pessoa.celular=>' + pessoa.celular)

                                                        client.messages
                                                            .create({
                                                                body: texto,
                                                                from: 'whatsapp:+554991832978',
                                                                to: 'whatsapp:+55' + pessoa.celular
                                                            })
                                                            .then((message) => {
                                                                q++
                                                                //console.log('q=>' + q)
                                                                //console.log('acesso.length=>' + acesso.length)
                                                                if (q == acesso.length) {
                                                                    //console.log(message.sid)
                                                                    req.flash('success_msg', 'Proposta ' + projeto.seq + ' ganha.')
                                                                    res.redirect('/dashboard/')
                                                                }
                                                            }).done()

                                                    }).catch((err) => {
                                                        req.flash('error_msg', 'Houve um erro ao encontrar a pessoa<whats>.')
                                                        res.redirect('/dashboard')
                                                    })
                                                })
                                            } else {
                                                req.flash('success_msg', projeto.seq + ' ganha.')
                                                res.redirect('/gerenciamento/orcamento/' + req.params.id)
                                            }
                                        }).catch((err) => {
                                            req.flash('error_msg', 'Houve um erro ao encontrar o acesso.')
                                            res.redirect('/dashboard')
                                        })
                                    }
                                }).catch((err) => {
                                    req.flash('error_msg', 'Houve erro ao salvar a tarefa.')
                                    res.redirect('/gerenciamento/orcamento/' + req.body.id)
                                })
                            })
                        }).catch((err) => {
                            req.flash('error_msg', 'Houve erro ao encontrar as atividades padrão.')
                            res.redirect('/gerenciamento/orcamento/' + req.body.id)
                        })
                        //         }).catch((err) => {
                        //             req.flash('error_msg', 'Houve erro ao salvar a atividade de instalação do inversor.')
                        //             res.redirect('/gerenciamento/projeto/' + req.body.id)
                        //         })
                        //     }).catch((err) => {
                        //         req.flash('error_msg', 'Houve erro ao salvar a atividade de instalação do aterramento.')
                        //         res.redirect('/gerenciamento/projeto/' + req.body.id)
                        //     })
                        // }).catch((err) => {
                        //     req.flash('error_msg', 'Houve erro ao salvar a atividade de instalação do telhado.')
                        //     res.redirect('/gerenciamento/projeto/' + req.body.id)
                        // })
                    }).catch(() => {
                        req.flash('error_msg', 'Falha ao salvar a equipe.')
                        res.redirect('/gerenciamento/orcamento/' + req.params.id)
                    })
                })
            }).catch(() => {
                req.flash('error_msg', 'Falha ao salvar o projeto.')
                res.redirect('/gerenciamento/orcamento/' + req.params.id)
            })
        }).catch(() => {
            req.flash('error_msg', 'Falha ao encontrar o cliente.')
            res.redirect('/gerenciamento/orcamento/' + req.params.id)
        })
    }).catch(() => {
        req.flash('error_msg', 'Falha ao encontrar o projeto.')
        res.redirect('/gerenciamento/orcamento/' + req.params.id)
    })
})

router.post('/projeto', ehAdmin, (req, res) => {
    const { _id } = req.user;
    const { pessoa } = req.user;

    var checkapr = false
    var checkpost = false
    var checksoli = false
    //console.log(req.body.id)
    Projeto.findOne({ _id: req.body.id }).then((projeto) => {

        if (naoVazio(projeto.dataPost)) {
            checkpost = true
        }

        if (naoVazio(projeto.dataSoli)) {
            checksoli = true
        }

        if (naoVazio(projeto.dataApro)) {
            checkapr = true
        }

        if (req.body.checkPost != null) {
            projeto.dataPost = dataHoje()
        } else {
            projeto.dataPost = req.body.dataPost
        }

        if (req.body.checkSoli != null) {
            projeto.dataSoli = dataHoje()
        } else {
            projeto.dataSoli = req.body.dataSoli
        }

        if (req.body.checkApro != null) {
            projeto.dataApro = dataHoje()
        } else {
            projeto.dataApro = req.body.dataApro
        }

        if (req.body.checkTroca != null) {
            projeto.dataTroca = dataHoje()
        } else {
            projeto.dataTroca = req.body.dataTroca
        }

        projeto.save().then(async () => {
            var projetoobs = await Projeto.findById(req.body.id).lean();
            //console.log(req.body.salvarObs);
            if (req.body.salvarObs == '1') salvarObservacao(projetoobs, req.body.obsprojetista, req.body.id, pessoa);

            if (checkpost == false && naoVazio(req.body.dataPost)) {
                //console.log('postado')
                Cliente.findOne({ _id: projeto.cliente }).then((cliente) => {
                    Acesso.findOne({ pessoa: projeto.vendedor, notvis: 'checked' }).then((acesso) => {
                        if (naoVazio(acesso)) {
                            Pessoa.findOne({ _id: projeto.vendedor }).then((vendedor) => {
                                //console.log('vendedor.celular=>' + vendedor.celular)
                                var mensagem = 'Olá ' + vendedor.nome + ',' + '\n' +
                                    'O projeto ' + projeto.seq + ' do cliente ' + cliente.nome + ' foi postado.' + '\n' +
                                    'Acompanhe a proposta acessando: https://integracao.vimmus.com.br/gerenciamento/orcamento/' + projeto._id + '.'
                                //console.log(mensagem)
                                client.messages
                                    .create({
                                        body: mensagem,
                                        from: 'whatsapp:+554991832978',
                                        to: 'whatsapp:+55' + vendedor.celular
                                    })
                                    .then((message) => {
                                        req.flash('success_msg', 'Projeto atualizado com sucesso')
                                        res.redirect('/gerenciamento/projeto/' + req.body.id)
                                    }).done()

                            }).catch(() => {
                                req.flash('error_msg', 'Falha ao encontrar o vendedor.')
                                res.redirect('/gerenciamento/projeto/' + req.params.id)
                            })
                        } else {
                            req.flash('success_msg', 'Projeto atualizado com sucesso')
                            res.redirect('/gerenciamento/projeto/' + req.body.id)
                        }
                    }).catch(() => {
                        req.flash('error_msg', 'Falha ao encontrar o acesso.')
                        res.redirect('/gerenciamento/projeto/' + req.params.id)
                    })
                }).catch(() => {
                    req.flash('error_msg', 'Falha ao encontrar o cliente.')
                    res.redirect('/gerenciamento/projeto/' + req.body.id)
                })
            } else {
                if (checksoli == false && naoVazio(req.body.dataSoli)) {
                    //console.log('solicitado')
                    Cliente.findOne({ _id: projeto.cliente }).then((cliente) => {
                        Acesso.findOne({ pessoa: projeto.vendedor, notvis: 'checked' }).then((acesso) => {
                            if (naoVazio(acesso)) {
                                Pessoa.findOne({ _id: projeto.vendedor }).then((vendedor) => {
                                    //console.log('vendedor.celular=>' + vendedor.celular)
                                    var mensagem = 'Olá ' + vendedor.nome + ',' + '\n' +
                                        'A vistoria da proposta ' + projeto.seq + ' do cliente ' + cliente.nome + ' foi solicitada.' + '\n' +
                                        'Acompanhe a proposta acessando: https://integracao.vimmus.com.br/gerenciamento/orcamento/' + projeto._id + '.'
                                    //console.log(mensagem)
                                    client.messages
                                        .create({
                                            body: mensagem,
                                            from: 'whatsapp:+554991832978',
                                            to: 'whatsapp:+55' + vendedor.celular
                                        })
                                        .then((message) => {
                                            req.flash('success_msg', 'Projeto atualizado com sucesso')
                                            res.redirect('/gerenciamento/projeto/' + req.body.id)
                                        }).done()

                                }).catch(() => {
                                    req.flash('error_msg', 'Falha ao encontrar o vendedor.')
                                    res.redirect('/gerenciamento/projeto/' + req.params.id)
                                })
                            } else {
                                req.flash('success_msg', 'Projeto atualizado com sucesso')
                                res.redirect('/gerenciamento/projeto/' + req.body.id)
                            }
                        }).catch(() => {
                            req.flash('error_msg', 'Falha ao encontrar o acesso.')
                            res.redirect('/gerenciamento/projeto/' + req.params.id)
                        })
                    }).catch(() => {
                        req.flash('error_msg', 'Falha ao encontrar o cliente.')
                        res.redirect('/gerenciamento/projeto/' + req.params.id)
                    })

                } else {
                    if (checkapr == false && naoVazio(req.body.dataApro)) {
                        //console.log('aprovado')
                        Cliente.findOne({ _id: projeto.cliente }).then((cliente) => {
                            Acesso.findOne({ pessoa: projeto.vendedor, notvis: 'checked' }).then((acesso) => {
                                if (naoVazio(acesso)) {
                                    Pessoa.findOne({ _id: projeto.vendedor }).then((vendedor) => {
                                        //console.log('vendedor.celular=>' + vendedor.celular)
                                        var mensagem = 'Olá ' + vendedor.nome + ',' + '\n' +
                                            'A vistoria da proposta ' + projeto.seq + ' do cliente ' + cliente.nome + ' foi aprovada.' + '\n' +
                                            'Acompanhe a proposta acessando: https://integracao.vimmus.com.br/gerenciamento/orcamento/' + projeto._id + '.'
                                        //console.log(mensagem)
                                        client.messages
                                            .create({
                                                body: mensagem,
                                                from: 'whatsapp:+554991832978',
                                                to: 'whatsapp:+55' + vendedor.celular
                                            })
                                            .then((message) => {
                                                req.flash('success_msg', 'Projeto atualizado com sucesso')
                                                res.redirect('/gerenciamento/projeto/' + req.body.id)
                                            }).done()

                                    }).catch(() => {
                                        req.flash('error_msg', 'Falha ao encontrar o vendedor.')
                                        res.redirect('/gerenciamento/projeto/' + req.params.id)
                                    })
                                } else {
                                    req.flash('success_msg', 'Projeto atualizado com sucesso')
                                    res.redirect('/gerenciamento/projeto/' + req.body.id)
                                }
                            }).catch(() => {
                                req.flash('error_msg', 'Falha ao encontrar o acesso.')
                                res.redirect('/gerenciamento/projeto/' + req.params.id)
                            })
                        }).catch(() => {
                            req.flash('error_msg', 'Falha ao encontrar o cliente.')
                            res.redirect('/gerenciamento/projeto/' + req.params.id)
                        })
                    } else {
                        req.flash('success_msg', 'Projeto atualizado com sucesso')
                        res.redirect('/gerenciamento/projeto/' + req.body.id)
                    }
                }
            }
        }).catch((err) => {
            req.flash('error_msg', 'Falha ao salvar o projeto.')
            res.redirect('/gerenciamento/projeto/' + req.body.id)
        })
    }).catch(() => {
        req.flash('error_msg', 'Falha ao encontrar o projeto.')
        res.redirect('/gerenciamento/projeto/' + req.params.id)
    })
})

router.post('/enviarEquipe/', ehAdmin, async (req, res) => {
    const { user } = req.user
    const { _id } = req.user
    var id

    if (naoVazio(user)) {
        id = user
    } else {
        id = _id
    }

    var mensagem
    var tipo

    const check = req.body.check

    const ins_realizado = await Pessoa.findById(req.body.ins_realizado)

    Projeto.findOne({ _id: req.body.id }).then((projeto) => {
        if (naoVazio(projeto)) {
            Equipe.findOne({ _id: projeto.equipe }).then((equipe) => {
                Pessoa.findOne({ _id: equipe.insres }).then((instalador) => {
                    Cliente.findOne({ _id: projeto.cliente }).then((cliente) => {
                        //console.log('equipe=>' + equipe)
                        if (projeto.parado == false && projeto.execucao == false) {
                            if (check) {
                                equipe.insres = ins_realizado
                                projeto.ins_real = true
                            } else {
                                projeto.ins_real = false
                                equipe.insres = projeto.ins_banco
                            }
                            projeto.execucao = true
                            projeto.parado = false
                            projeto.dtiniicio = req.body.dtfim
                            projeto.dtfim = req.body.dtfim
                            equipe.liberar = true
                            equipe.dtinicio = req.body.dtfim
                            equipe.dtfim = req.body.dtfim
                            equipe.dtinibusca = dataBusca(req.body.dtfim)
                            equipe.dtfimbusca = dataBusca(req.body.dtfim)
                            projeto.save()
                            equipe.save().then(() => {
                                mensagem = 'Olá ' + instalador.nome + ',' + '\n' +
                                    'Instalação programada para o cliente ' + cliente.nome + '\n' +
                                    // 'com previsão para inicio em ' + dataMensagem(projeto.dtinicio) + ' e término em ' + dataMensagem(projeto.dtfim) + '.' + '\n' +
                                    // 'Acompanhe a obra acessando: https://integracao.vimmus.com.br/gerenciamento/instalacao/' + projeto._id + '.'
                                    'Verifique seu aplicativo e aguarde a gerência entrar em contato.'
                                client.messages
                                    .create({
                                        body: mensagem,
                                        from: 'whatsapp:+554991832978',
                                        to: 'whatsapp:+55' + instalador.celular
                                    })
                                    .then((message) => {
                                        req.flash('success_msg', 'Instalador alocado para o projeto ' + projeto.seq + '.')
                                        res.redirect('/gerenciamento/emandamento')
                                    }).done()
                            }).catch((err) => {
                                req.flash('error_msg', 'Houve erro ao salvar a equipe.')
                                res.redirect('/gerenciamento/emandamento')
                            })

                        } else {
                            if (projeto.parado == false) {
                                projeto.execucao = true
                                projeto.parado = true
                                mensagem = 'Equipe de instalação cancelada'
                                tipo = 'error_msg'
                                equipe.parado = true
                            } else {
                                projeto.execucao = true
                                projeto.parado = false
                                mensagem = 'Equipe de instalação enviada'
                                tipo = 'success_msg'
                                equipe.parado = false
                            }
                            equipe.save()
                            projeto.save().then(() => {
                                //console.log('cliente=>' + cliente)
                                mensagem = mensagem + ' para o cliente ' + cliente.nome + '\n' + '.'
                                // 'com previsão para inicio em ' + dataMensagem(projeto.dtinicio) + ' e término em ' + dataMensagem(projeto.dtfim) + ' foi cancelada.' + '\n' +
                                'Aguarde a gerência entrar em contato.'
                                client.messages
                                    .create({
                                        body: mensagem,
                                        from: 'whatsapp:+554991832978',
                                        to: 'whatsapp:+55' + instalador.celular
                                    })
                                    .then((message) => {
                                        req.flash(tipo, mensagem)
                                        res.redirect('/gerenciamento/emandamento')
                                    }).done()
                            }).catch((err) => {
                                req.flash('error_msg', 'Houve erro ao salvar a projeto.')
                                res.redirect('/gerenciamento/emandamento')
                            })
                        }
                    }).catch((err) => {
                        req.flash('error_msg', 'Houve erro ao encontrar o cliente<envia>.')
                        res.redirect('/gerenciamento/emandamento')
                    })
                }).catch((err) => {
                    req.flash('error_msg', 'Houve erro ao encontrar o instalador<envia>.')
                    res.redirect('/gerenciamento/emandamento')
                })
            }).catch((err) => {
                req.flash('error_msg', 'Houve erro ao encontrar a equipe.')
                res.redirect('/gerenciamento/emandamento')
            })
        } else {
            Tarefas.findOne({ _id: req.body.id }).then((tarefa) => {
                Equipe.findOne({ _id: tarefa.equipe }).then((equipe) => {
                    if (naoVazio(equipe.insres)) {
                        mensagem = 'Equipe liberada para o serviço.'
                        tipo = 'success_msg'
                        equipe.liberar = true
                        equipe.save().then(() => {
                            //console.log('email=>' + email)
                            Pessoa.findOne({ _id: equipe.insres }).then((insres) => {
                                //console.log('insres.nome=>' + insres.nome)
                                req.flash(tipo, mensagem)
                                res.redirect('/gerenciamento/mostraEquipe/' + req.body.id)

                            }).catch((err) => {
                                req.flash('error_msg', 'Houve erro ao encontrar o instalador responsável.')
                                res.redirect('/gerenciamento/mostraEquipe/' + req.body.id)
                            })
                        }).catch((err) => {
                            req.flash('error_msg', 'Houve erro ao salvar a equipe.')
                            res.redirect('/gerenciamento/mostraEquipe/' + req.body.id)
                        })
                    } else {
                        req.flash('aviso_msg', 'Só será possível libera a equipe para a obra após selecionar um técnico responsável.')
                        res.redirect('/gerenciamento/equipe/' + req.body.id)
                    }
                }).catch((err) => {
                    req.flash('error_msg', 'Houve erro ao encontrar a equipe.')
                    res.redirect('/gerenciamento/mostraEquipe/' + req.body.id)
                })
            }).catch((err) => {
                req.flash('error_msg', 'Houve erro ao encontrar a tarefa.')
                res.redirect('/gerenciamento/mostraEquipe/' + req.body.id)
            })
        }
    }).catch((err) => {
        req.flash('error_msg', 'Houve erro ao encontrar a projeto.')
        res.redirect('/gerenciamento/emandamento')
    })
})

router.post('/addInstalador/', ehAdmin, (req, res) => {
    const { user } = req.user
    const { _id } = req.user
    var id
    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }
    //console.log(req.body.id)
    Projeto.findOne({ _id: req.body.id }).then((projeto) => {
        projeto.ins_banco = req.body.instalador
        projeto.save()
        Equipe.findOne({ _id: projeto.equipe }).then((equipe) => {
            equipe.insres = req.body.instalador
            equipe.qtdmod = req.body.qtdmod
            equipe.save().then(() => {
                req.flash('success_msg', 'Instalador alocado para o projeto ' + projeto.seq + '.')
                res.redirect('/gerenciamento/emandamento')
            }).catch((err) => {
                req.flash('error_msg', 'Houve erro ao salvar a equipe.')
                res.redirect('/gerenciamento/emandamento')
            })
        }).catch((err) => {
            req.flash('error_msg', 'Houve erro ao encontrar a equipe.')
            res.redirect('/gerenciamento/emandamento')
        })

    }).catch((err) => {
        req.flash('error_msg', 'Houve erro ao encontrar a projeto.')
        res.redirect('/gerenciamento/emandamento/')
    })
})

router.post('/salvarImagem', ehAdmin, upload.array('files', 20), (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    var id
    var cont = 0
    var notimg = true
    var q = 0

    //console.log('req.file.path=>'+req.files.path)

    // (async() =>  {
    //     await sharp(req.files.path)
    //     .resize(540,960)
    //     .png({quality: 90})
    //     .toFile(
    //         path.resolve(req.file.destination, 'resize', image)
    //     )
    // })

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }

    var arquivos = req.files
    //console.log('req.files=>' + req.files)
    var imagem
    var ativo = false
    var mensagem
    const vardate = new Date().getSeconds() + '_' + new Date().getFullYear() + '_' + new Date().getMonth() + '_' + new Date().getDate() + '_'

    //console.log("tipo=>" + req.body.tipo)
    //console.log("id=>" + req.body.idprj)

    if (naoVazio(arquivos)) {
        //console.log('arquivos=>' + arquivos.length)
        arquivos.forEach((e) => {
            if (req.body.tipo == 'assistencia') {
                imagem = { fotos: { "desc": req.body.seq + '_' + e.originalname, "data": dataHoje() }, }

                Tarefas.findOneAndUpdate({ _id: req.body.id }, { $set: { datafim: dataHoje() } }).then((e) => {
                    Tarefas.findOneAndUpdate({ _id: req.body.id }, { $push: imagem }).then((e) => {
                        var concluido = {}
                        concluido = { 'concluido': true, 'solucao': req.body.solucao }

                        //console.log('concluido=>' + JSON.stringify(concluido))
                        Tarefas.findOneAndUpdate({ _id: req.body.id }, concluido).then((e) => {

                            res.redirect('/gerenciamento/assistencia')

                        }).catch((err) => {
                            req.flash('error_msg', 'Houve erro ao encontrar a tarefa.')
                            res.redirect('/dashboard')
                        })
                    })
                })
            } else {
                //console.log('req.body.idprj=>' + req.body.idprj)
                Projeto.findOne({ _id: req.body.idprj }).then((prj) => {
                    Cliente.findOne({ _id: prj.cliente }).then((cliente) => {
                        if (req.body.tipo == 'projeto') {
                            console.log("caminho=>" + req.body.caminho)
                            if ((req.body.caminho == 'fatura') || (req.body.caminho == 'documento') || (req.body.caminho == 'entrada')
                                || (req.body.caminho == 'disjuntor') || (req.body.caminho == 'trafo') || (req.body.caminho == 'localizacao'
                                    || (req.body.caminho == 'telhado') || req.body.caminho == 'local')
                                || (req.body.caminho == 'medidor')) {
                                //console.log('é telhado=>' + req.body.seq)
                                imagem = { "desc": req.body.seq + '_' + e.originalname, "data": dataHoje() }
                            } else {
                                imagem = { "desc": req.body.seq + '_' + e.originalname }
                            }

                            var disjuntor
                            var medidor
                            var trafo
                            if (req.body.caminho == 'disjuntor') {
                                console.log('entrou disjuntor')
                                disjuntor = imagem
                                medidor = prj.medidor
                                trafo = prj.trafo
                            }
                            if (req.body.caminho == 'medidor') {
                                medidor = imagem
                                disjuntor = prj.disjuntor
                                trafo = prj.trafo
                            }
                            if (req.body.caminho == 'trafo') {
                                trafo = imagem
                                disjuntor = prj.disjuntor
                                medidor = prj.medidor
                            }

                            //console.log('caminho=>' + req.body.caminho)
                            //console.log('disjuntor=>' + naoVazio(disjuntor))
                            //console.log('medidor=>' + naoVazio(medidor))
                            //console.log('trafo=>' + naoVazio(trafo))

                            var levantamento = false
                            if ((req.body.caminho == 'disjuntor' || req.body.caminho == 'medidor' || req.body.caminho == 'trafo') &&
                                (naoVazio(disjuntor) && naoVazio(medidor) && naoVazio(trafo))) {
                                levantamento = true
                            }

                            console.log('levantamento=>' + levantamento)
                            var texto
                            if (req.body.caminho == 'fatura') {
                                Projeto.findOneAndUpdate({ _id: req.body.idprj }, { $push: { fatura: imagem } }).then((e) => {
                                    texto = 'Fatura(s) salva(s) com sucesso.'
                                })
                            } else {
                                if (req.body.caminho == 'documento') {
                                    Projeto.findOneAndUpdate({ _id: req.body.idprj }, { $push: { documento: imagem } }).then((e) => {
                                        texto = 'Documento(s) salvo(s) com sucesso.'
                                    })
                                } else {
                                    if (req.body.caminho == 'local') {
                                        Projeto.findOneAndUpdate({ _id: req.body.idprj }, { $push: { local: imagem } }).then((e) => {
                                            texto = 'Local(ais) salvo(s) com sucesso.'
                                        })
                                    } else {
                                        if (req.body.caminho == 'entrada') {
                                            Projeto.findOneAndUpdate({ _id: req.body.idprj }, { $push: { entrada: imagem } }).then((e) => {
                                                texto = 'Entrada(s) salva(s) com sucesso.'
                                            })
                                        } else {
                                            if (req.body.caminho == 'disjuntor') {
                                                console.log('push disjuntor')
                                                Projeto.findOneAndUpdate({ _id: req.body.idprj }, { $push: { disjuntor: imagem } }).then((e) => {
                                                    if (!levantamento) {
                                                        texto = 'Disjuntor(es) salvo(s) com sucesso.'
                                                    }
                                                })
                                            } else {
                                                if (req.body.caminho == 'trafo') {
                                                    Projeto.findOneAndUpdate({ _id: req.body.idprj }, { $push: { trafo: imagem } }).then((e) => {
                                                        if (!levantamento) {
                                                            texto = 'Trafo(s) salvo(s) com sucesso.'
                                                        }
                                                    })
                                                } else {
                                                    if (req.body.caminho == 'localizacao') {
                                                        Projeto.findOneAndUpdate({ _id: req.body.idprj }, { $push: { localizacao: imagem } }).then((e) => {
                                                            texto = 'Localização(ões) salva(s) com sucesso.'
                                                        })
                                                    } else {
                                                        if (req.body.caminho == 'telhado') {
                                                            //console.log('salva telhado=>' + req.body.idprj)
                                                            Projeto.findOneAndUpdate({ _id: req.body.idprj }, { $push: { telhado_foto: imagem } }).then((e) => {
                                                                texto = 'Foto(s) do(s) telhado(s) salva(s) com sucesso.'
                                                            })
                                                        } else {
                                                            if (req.body.caminho == 'medidor') {
                                                                Projeto.findOneAndUpdate({ _id: req.body.idprj }, { $push: { medidor: imagem } }).then((e) => {
                                                                    if (!levantamento) {
                                                                        texto = 'Medidor(ees) salvo(s) com sucesso.'
                                                                    }
                                                                })
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            if (levantamento) {
                                console.log('levantamento de rede')
                                Acesso.find({ user: id, notdoc: 'checked' }).then((acesso) => {
                                    if (naoVazio(acesso)) {
                                        acesso.forEach((e) => {
                                            Pessoa.findOne({ _id: e.pessoa }).then((projetista) => {
                                                //console.log(pessoa.celular)
                                                mensagem = 'Olá ' + projetista.nome + ',' + '\n' +
                                                    'O levantamento de rede da proposta ' + prj.seq + ' foi adicionado.' + '\n' +
                                                    'Acesse: https://quasat.vimmus.com.br/orcamento/' + prj._id + ' para mais informações.'
                                                client.messages
                                                    .create({
                                                        body: mensagem,
                                                        from: 'whatsapp:+554991832978',
                                                        to: 'whatsapp:+55' + projetista.celular
                                                    })
                                                    .then((message) => {
                                                        //console.log(message.sid)
                                                        cont++
                                                        //console.log('cont=>' + cont)
                                                        if (cont == acesso.length) {
                                                            req.flash('success_msg', 'Levantamento de rede realizado com sucesso.')
                                                            res.redirect('/gerenciamento/fotos/' + req.body.idprj)
                                                        }
                                                    }).done()
                                            }).catch((err) => {
                                                req.flash('error_msg', 'Houve erro ao encontrar o projetista.')
                                                res.redirect('/gerenciamento/fotos/' + req.body.idprj)
                                            })
                                        })
                                    } else {
                                        //console.log('aguardando')
                                        if (req.body.caminho == 'fatura') {
                                            req.flash('success_msg', 'Imagem salva com sucesso')
                                            res.redirect('/gerenciamento/fatura/' + req.body.idprj)
                                        } else {
                                            //console.log('texto=>' + texto)
                                            req.flash('success_msg', texto)
                                            res.redirect('/gerenciamento/fotos/' + req.body.idprj)
                                        }
                                    }
                                }).catch((err) => {
                                    req.flash('error_msg', 'Houve erro ao encontrar o acesso.')
                                    res.redirect('/gerenciamento/fotos/' + req.body.idprj)
                                })
                            } else {
                                if (req.body.caminho == 'fatura') {
                                    req.flash('success_msg', 'Imagem da fatura salva com sucesso')
                                    res.redirect('/gerenciamento/fatura/' + req.body.idprj)
                                } else {
                                    req.flash('success_msg', texto)
                                    res.redirect('/gerenciamento/fotos/' + req.body.idprj)
                                }
                            }
                        } else {
                            if (req.body.tipo == 'tarefa') {
                                //console.log('instalação')
                                //console.log('req.body.check=>' + req.body.check)
                                if (req.body.check == 'Aprovado') {
                                    ativo = true
                                } else {
                                    ativo = false
                                }


                                imagem = { fotos: { "desc": req.body.seq + '_' + e.originalname, "data": dataHoje() } }

                                Tarefas.findOneAndUpdate({ _id: req.body.id }, { $push: imagem }).then((e) => {
                                    Tarefas.findOneAndUpdate({ _id: req.body.id }, { $set: { datafim: dataHoje() } }).then((e) => {
                                        req.flash('success_msg', 'Foto(s) da instalação salva(s) com sucesso.')
                                    })
                                })

                                var concluido = {}
                                concluido = { 'concluido': ativo }

                                //console.log('concluido=>' + JSON.stringify(concluido))
                                //console.log('req.body.id=>' + req.body.id)
                                Tarefas.findOneAndUpdate({ _id: req.body.id }, concluido).then((e) => {
                                    Tarefas.find({ projeto: req.body.idprj }).then(async (lista_tarefas) => {
                                        if (ativo == true) {
                                            req.flash('success_msg', 'Imagem(ns) da(s) instalação aprovada(s)')
                                            await Projeto.findOneAndUpdate({ _id: req.body.idprj }, { $set: { instalado: true } })
                                        }

                                        lista_tarefas.forEach((e) => {
                                            //console.log('e.fotos=>' + e.fotos)
                                            if (naoVazio(e.fotos) == false) {
                                                notimg = false
                                            }
                                        })
                                        if (notimg == true) {
                                            Acesso.find({ user: id, notimg: 'checked' }).then((acesso) => {
                                                if (naoVazio(acesso)) {
                                                    acesso.forEach((e) => {
                                                        Pessoa.findOne({ _id: e.pessoa }).then((pessoa) => {
                                                            //console.log('enviou mensagem')
                                                            texto = 'Olá ' + pessoa.nome + ',' + '\n' +
                                                                'Todas as fotos da obra do projeto ' + prj.seq + ' para o cliente ' + cliente.nome + '  estão na plataforma. ' +
                                                                'Acesse https://vimmus.com.br/gerenciamento/orcamento/' + prj._id + ' para verificar.'
                                                            //console.log('pessoa.celular=>'+pessoa.celular)
                                                            client.messages
                                                                .create({
                                                                    body: texto,
                                                                    from: 'whatsapp:+554991832978',
                                                                    to: 'whatsapp:+55' + pessoa.celular
                                                                })
                                                                .then((message) => {
                                                                    q++
                                                                    //console.log('q=>' + q)
                                                                    //console.log('acesso.length=>' + acesso.length)
                                                                    if (q == acesso.length) {
                                                                        //console.log(message.sid)
                                                                        if (req.body.caminho == 'instalacao') {
                                                                            if (req.body.usuario == 'gestor') {
                                                                                //console.log('req.body.idprj=>' + req.body.idprj)
                                                                                res.redirect('/gerenciamento/instalacao/' + req.body.idprj)
                                                                            } else {
                                                                                res.redirect('/gerenciamento/mostrarFotos/tarefa@' + req.body.id + '@' + req.body.idprj)
                                                                            }
                                                                        } else {
                                                                            res.redirect('/gerenciamento/mostraEquipe/' + req.body.id)
                                                                        }
                                                                    }
                                                                }).done()

                                                        }).catch((err) => {
                                                            req.flash('error_msg', 'Houve um erro ao encontrar a pessoa<whats>.')
                                                            res.redirect('/dashboard')
                                                        })
                                                    })
                                                } else {
                                                    if (req.body.caminho == 'instalacao') {
                                                        if (req.body.usuario == 'gestor') {
                                                            //console.log('req.body.idprj=>' + req.body.idprj)
                                                            res.redirect('/gerenciamento/instalacao/' + req.body.idprj)
                                                        } else {
                                                            res.redirect('/gerenciamento/mostrarFotos/tarefa@' + req.body.id + '@' + req.body.idprj)
                                                        }
                                                    } else {
                                                        res.redirect('/gerenciamento/mostraEquipe/' + req.body.id)
                                                    }
                                                }
                                            }).catch((err) => {
                                                req.flash('error_msg', 'Houve erro ao encontrar o acesso.')
                                                res.redirect('/gerenciamento/fotos/' + req.body.id)
                                            })
                                        } else {
                                            if (req.body.caminho == 'instalacao') {
                                                if (req.body.usuario == 'gestor') {
                                                    //console.log('req.body.idprj=>' + req.body.idprj)
                                                    res.redirect('/gerenciamento/instalacao/' + req.body.idprj)
                                                } else {
                                                    res.redirect('/gerenciamento/mostrarFotos/tarefa@' + req.body.id + '@' + req.body.idprj)
                                                }
                                            } else {
                                                res.redirect('/gerenciamento/mostraEquipe/' + req.body.id)
                                            }
                                        }
                                    }).catch((err) => {
                                        req.flash('error_msg', 'Houve erro ao encontrar a tarefa.')
                                        res.redirect('/dashboard')
                                    })
                                }).catch((err) => {
                                    req.flash('error_msg', 'Houve erro ao encontrar a tarefa.')
                                    res.redirect('/dashboard')
                                })
                            } else {
                                if (req.body.tipo == 'termo') {
                                    //console.log('entrou termo')
                                    Projeto.findOneAndUpdate({ _id: req.body.idprj }, { $set: { termo: { "desc": req.body.seq + '_' + e.originalname, "data": dataHoje() } } }).then((e) => {
                                        req.flash('success_msg', 'Termo de entrega salvo com sucesso.')
                                        res.redirect('/gerenciamento/orcamento/' + req.body.idprj)
                                    })
                                }
                            }
                        }
                    }).catch((err) => {
                        req.flash('error_msg', 'Houve erro ao encontrar o cliente.')
                        res.redirect('/gerenciamento/fotos/' + req.body.id)
                    })
                }).catch((err) => {
                    req.flash('error_msg', 'Houve erro ao encontrar o projeto.')
                    res.redirect('/gerenciamento/fotos/' + req.body.id)
                })
            }
        })
    } else {
        if (req.body.tipo == 'tarefa') {
            //console.log('aprovação')
            //console.log('req.body.check=>' + req.body.check)
            if (req.body.check == 'Aprovado') {
                ativo = true
            } else {
                ativo = false
            }

            //console.log('req.body.id=>' + req.body.id)
            Tarefas.findOneAndUpdate({ _id: req.body.id }, { $set: { concluido: ativo } }).then((e) => {
                if (ativo == true) {
                    req.flash('success_msg', 'Imagem(ns) da(s) instalação aprovada(s)')
                } else {
                    req.flash('success_msg', 'Imagem(ns) da(s) instalação para averiguar(s)')
                }
                if (req.body.caminho == 'instalacao') {
                    if (req.body.usuario == 'gestor') {
                        //console.log('req.body.idprj=>' + req.body.idprj)
                        res.redirect('/gerenciamento/instalacao/' + req.body.idprj)
                    } else {
                        res.redirect('/gerenciamento/mostrarFotos/tarefa@' + req.body.id + '@' + req.body.idprj)
                    }
                } else {
                    res.redirect('/gerenciamento/mostraEquipe/' + req.body.id)
                }
            }).catch((err) => {
                req.flash('error_msg', 'Houve erro ao encontrar a tarefa.')
                res.redirect('/dashboard')
            })
        } else {
            req.flash('aviso_mag', 'Nenhum arquivo adicionado.')
            res.redirect('/gerenciamento/fotos/' + req.body.id)
        }
    }
})

router.get('/deletaImagem/:msg', ehAdmin, (req, res) => {
    var params = []
    params = req.params.msg
    params = params.split('delimg')
    //console.log('params[1]=>'+params[1])
    //console.log('params[2]=>' + params[2])
    //console.log('params[3]=>' + params[3])
    if (params[2] == 'fatura') {
        Projeto.findOneAndUpdate({ _id: params[3] }, { $pull: { 'fatura': { '_id': params[1] } } }).then(() => {
            req.flash('success_msg', 'Imagem da fatura removida com sucesso.')
            res.redirect('/gerenciamento/fatura/' + params[3])
        }).catch((err) => {
            req.flash('error_msg', 'Houve erro ao excluir a equipe.')
            res.redirect('/gerenciamento/orcamento/' + params[3])
        })
    } else {
        if (params[2] == 'fotos') {
            var sql = {}
            if (params[4] == 'documento') {
                //console.log('params[1]=>' + params[1])
                sql = { 'documento': { '_id': params[1] } }
            }
            if (params[4] == 'local') {
                //console.log('params[1]=>' + params[1])
                sql = { 'local': { '_id': params[1] } }
            }
            if (params[4] == 'entrada') {
                sql = { 'entrada': { '_id': params[1] } }
            }
            if (params[4] == 'disjuntor') {
                sql = { 'disjuntor': { '_id': params[1] } }
            }
            if (params[4] == 'trafo') {
                sql = { 'trafo': { '_id': params[1] } }
            }
            if (params[4] == 'localizacao') {
                sql = { 'localizacao': { '_id': params[1] } }
            }
            if (params[4] == 'telhado') {
                sql = { 'telhado_foto': { '_id': params[1] } }
            }
            if (params[4] == 'medidor') {
                sql = { 'medidor': { '_id': params[1] } }
            }
            //console.log('params[3]=>' + params[3])
            //console.log('sql=>' + JSON.stringify(sql))
            Projeto.findOneAndUpdate({ _id: params[3] }, { $pull: sql }).then(() => {
                req.flash('success_msg', 'Imagem removida com sucesso.')
                if (params[2] == 'fatura') {
                    res.redirect('/gerenciamento/fatura/' + params[3])
                } else {
                    res.redirect('/gerenciamento/fotos/' + params[3])
                }
            }).catch((err) => {
                req.flash('error_msg', 'Houve erro ao excluir a equipe.')
                res.redirect('/gerenciamento/fotos/' + params[3])
            })
        } else {
            if (params[2] == 'tarefa') {
                //console.log('entrou')
                Tarefas.findOneAndUpdate({ _id: params[1] }, { $pull: { 'fotos': { 'desc': params[0] } } }).then((e) => {
                    req.flash('aviso_msg', 'Imagem removida com sucesso')
                    //console.log('params[1]=>' + params[1])
                    if (params[3] == 'gestao') {
                        res.redirect('/gerenciamento/verFotos/' + params[1])
                    } else {
                        res.redirect('/gerenciamento/mostrarFotos/tarefa@' + params[1] + '@' + params[3])
                    }
                }).catch((err) => {
                    req.flash('error_msg', 'Falha ao remover a imagem.')
                    res.redirect('/gerenciamento/instalacao/' + params[1])
                })
            } else {
                if (params[2] == 'assistencia') {
                    //console.log('entrou')
                    Tarefas.findOneAndUpdate({ _id: params[1] }, { $pull: { 'fotos': { 'desc': params[0] } } }).then((e) => {
                        req.flash('aviso_msg', 'Imagem removida com sucesso')
                        //console.log('params[1]=>' + params[1])
                        if (params[3] == 'gestao') {
                            res.redirect('/gerenciamento/verFotos/' + params[1])
                        } else {
                            res.redirect('/gerenciamento/mostrarFotos/assistencia@' + params[1])
                        }
                    }).catch((err) => {
                        req.flash('error_msg', 'Falha ao remover a imagem.')
                        res.redirect('/gerenciamento/instalacao/' + params[1])
                    })
                }
            }
        }
    }
})

router.get('/mostrarBucket/:docimg', ehAdmin, (req, res) => {
    //console.log("req.params.docimg=>" + req.params.docimg)
    s3.getObject(
        { Bucket: "quasatimg", Key: req.params.docimg },
        function (error, data) {
            if (error != null) {
                //console.log("Failed to retrieve an object: " + error);
            } else {
                //console.log(data.ContentLength)
                res.send(data.Body)
            }
        }
    )
})

router.get('/recuperar/:id', ehAdmin, (req, res) => {
    //console.log("req.params.docimg=>" + req.params.docimg)
    Projeto.findOne({ _id: req.params.id }).then((projeto) => {
        projeto.baixada = false
        projeto.status = 'Negociando'
        projeto.save().then(() => {
            req.flash('success_msg', 'Proposta recuperada.')
            res.redirect('/dashboard')
        })
    }).catch(() => {
        req.flash('error_msg', 'Falha ao encontrar o projeto.')
        res.redirect('/gerenciamento/selecao/' + req.body.id)
    })
})

router.get('/desfazerGanho/:id', ehAdmin, (req, res) => {
    //console.log("req.params.docimg=>" + req.params.docimg)
    Projeto.findOne({ _id: req.params.id }).then((projeto) => {
        projeto.ganho = false
        projeto.entregue = true
        projeto.dtentrega = dataHoje()
        projeto.status = 'Enviado'
        projeto.save().then(() => {
            req.flash('success_msg', 'Proposta ganha desfeita.')
            res.redirect('/dashboard/')
        })
    }).catch(() => {
        req.flash('error_msg', 'Falha ao encontrat o projeto')
        res.redirect('/dashboard/')
    })
})

router.get('/desfazerEntregue/:id', ehAdmin, (req, res) => {
    //console.log("req.params.docimg=>" + req.params.docimg)
    Projeto.findOne({ _id: req.params.id }).then((projeto) => {
        projeto.ganho = false
        projeto.entregue = false
        projeto.dtentrega = dataHoje()
        projeto.status = 'Enviado'
        projeto.save().then(() => {
            req.flash('success_msg', 'Proposta ganha desfeita.')
            res.redirect('/dashboard/')
        })
    }).catch(() => {
        req.flash('error_msg', 'Falha ao encontrat o projeto')
        res.redirect('/dashboard/')
    })
})

router.get('/entrega/:id', ehAdmin, (req, res) => {
    var id
    const { _id } = req.user
    const { user } = req.user
    var instalado = true
    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }
    Projeto.findOne({ _id: req.params.id }).then((projeto) => {
        Equipe.findOne({ _id: projeto.equipe }).then((equipe) => {

            instalado = projeto.instalado

            if (instalado) {
                if (projeto.encerrado == false) {
                    req.flash('aviso_msg', 'Projeto encerrado')
                    projeto.status = 'Instalação Realizada'
                    projeto.encerrado = true
                    projeto.save().then(() => {
                        Usina.findOne({ projeto: req.params.id }).then((usina) => {
                            //console.log('usina=>' + naoVazio(usina))
                            if (naoVazio(usina) == false) {
                                var cadastro = dataHoje()
                                var datalimp = dataMensagem(setData(dataHoje(), 182))
                                var buscalimp = dataBusca(setData(dataHoje(), 182))
                                var datarevi = dataMensagem(setData(dataHoje(), 30))
                                var buscarevi = dataBusca(setData(dataHoje(), 30))

                                const usina = {
                                    user: id,
                                    nome: equipe.nome_projeto,
                                    projeto: projeto._id,
                                    cliente: projeto.cliente,
                                    endereco: projeto.endereco,
                                    area: 0,
                                    qtdmod: 0,
                                    cadastro: cadastro,
                                    datalimp: datalimp,
                                    buscalimp: buscalimp,
                                    datarevi: datarevi,
                                    buscarevi: buscarevi
                                }

                                new Usina(usina).save().then(() => {
                                    //console.log('salvou usina')
                                    Usina.findOne({ user: id }).sort({ field: 'asc', _id: -1 }).then((novausina) => {
                                        const tarefa = {
                                            user: id,
                                            usina: novausina._id,
                                            dataini: setData(dataHoje(), 182),
                                            buscadataini: dataBusca(setData(dataHoje(), 182)),
                                            datafim: setData(dataHoje(), 182),
                                            buscadatafim: dataBusca(setData(dataHoje(), 182)),
                                            cadastro: dataHoje(),
                                            endereco: projeto.endereco,
                                            concluido: false,
                                            equipe: null,
                                            tipo: 'programacao',
                                            emandamento: false
                                        }
                                        new Tarefas(tarefa).save().then(() => {
                                            req.flash('success_msg', 'Usina gerada com sucesso.')
                                            res.redirect('/gerenciamento/orcamento/' + req.params.id)
                                        }).catch((err) => {
                                            req.flash('error_msg', 'Erro ao salvar a tarefa.')
                                            res.redirect('/gerenciamento/orcamento/' + req.params.id)
                                        })
                                    }).catch((err) => {
                                        req.flash('error_msg', 'Erro ao encontrar a usina.')
                                        res.redirect('/gerenciamento/instalacao/' + req.params.id)
                                    })
                                })
                            } else {
                                req.flash('aviso_msg', ' usina já foi gerada.')
                                res.redirect('/gerenciamento/instalacao/' + req.params.id)
                            }
                        }).catch((err) => {
                            req.flash('error_msg', 'Erro ao salvar a equipe.')
                            res.redirect('/gerenciamento/instalacao/' + req.params.id)
                        })
                    })
                } else {
                    projeto.encerrado = false
                    projeto.status = 'Ganho'
                    projeto.save().then(() => {
                        Usina.findOneAndDelete({ projeto: req.params.id }).then(() => {
                            req.flash('aviso_msg', 'Projeto em aberto.')
                            res.redirect('/gerenciamento/orcamento/' + req.params.id)
                        }).catch((err) => {
                            req.flash('error_msg', 'Erro ao deletar a usina.')
                            res.redirect('/gerenciamento/orcamento/' + req.params.id)
                        })
                    }).catch(() => {
                        req.flash('error_msg', 'Falha ao salvar o projeto.')
                        res.redirect('/gerenciamento/instalacao/' + req.params.id)
                    })
                }
            } else {
                projeto.instalado = true
                projeto.save().then(() => {
                    equipe.prjfeito = true
                    equipe.save().then(() => {
                        res.redirect('/gerenciamento/instalacao/' + req.params.id)
                    }).catch(() => {
                        req.flash('error_msg', 'Falha ao salvar o projeto.')
                        res.redirect('/gerenciamento/instalacao/' + req.params.id)
                    })
                })
            }

        }).catch(() => {
            req.flash('error_msg', 'Falha ao encontrar a equipe.')
            res.redirect('/gerenciamento/instalacao/' + req.params.id)
        })
    }).catch(() => {
        req.flash('error_msg', 'Falha ao encontrar o projeto.')
        res.redirect('/gerenciamento/instalacao/' + req.params.id)
    })
})

router.post('/plano', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    var id

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }
    var fidelidade
    if (req.body.fidelidade == '' || typeof req.body.fidelidade == 'undefined') {
        fidelidade = 0
    } else {
        fidelidade = req.body.fidelidade
    }
    //console.log('id=>' + req.body.id)
    //console.log('fidelidade=>' + req.body.fidelidade)
    if (req.body.id != '' && typeof req.body.id != 'undefined') {
        Plano.findOne({ _id: req.body.id }).then((existeplano) => {
            existeplano.nome = req.body.nome
            existeplano.qtdini = req.body.qtdini
            existeplano.qtdfim = req.body.qtdfim
            existeplano.mensalidade = req.body.mensalidade
            existeplano.fidelidade = fidelidade
            existeplano.save().then(() => {
                req.flash('success_msg', 'Plano salvo com sucesso.')
                res.redirect('/gerenciamento/plano/' + req.body.id)
            }).catch((err) => {
                req.flash('error_msg', 'Falha ao salvar o plano.')
                res.redirect('/gerenciamento/plano')
            })
        }).catch((err) => {
            req.flash('error_msg', 'Falha ao encontrar o plano.')
            res.redirect('/gerenciamento/plano')
        })
    } else {
        //console.log('novo plano')
        new Plano({
            user: id,
            nome: req.body.nome,
            qtdini: req.body.qtdini,
            qtdfim: req.body.qtdfim,
            mensalidade: req.body.mensalidade,
            fidelidade: fidelidade,
        }).save().then(() => {
            Plano.findOne({ user: id }).sort({ field: 'asc', _id: -1 }).lean().then((novoplano) => {
                req.flash('success_msg', 'Plano salvo com sucesso.')
                res.redirect('/gerenciamento/plano/' + novoplano._id)
            }).catch((err) => {
                req.flash('error_msg', 'Falha ao encontrar o plano.')
                res.redirect('/gerenciamento/plano')
            })
        }).catch((err) => {
            req.flash('error_msg', 'Falha ao salvar o plano.')
            res.redirect('/gerenciamento/plano')
        })
    }
})

router.post('/aplicarTarefas/', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    var id

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }
    var dia

    var mes
    var dif
    var difmes
    var dtinicio
    var dtfim
    var anoinicio
    var anofim
    var mesinicio
    var mesfim
    var diainicio
    var diafim

    var dia01 = []
    var dia02 = []
    var dia03 = []
    var dia04 = []
    var dia05 = []
    var dia06 = []
    var dia07 = []
    var dia08 = []
    var dia09 = []
    var dia10 = []
    var dia11 = []
    var dia12 = []
    var dia13 = []
    var dia14 = []
    var dia15 = []
    var dia16 = []
    var dia17 = []
    var dia18 = []
    var dia19 = []
    var dia20 = []
    var dia21 = []
    var dia22 = []
    var dia23 = []
    var dia24 = []
    var dia25 = []
    var dia26 = []
    var dia27 = []
    var dia28 = []
    var dia29 = []
    var dia30 = []
    var dia31 = []

    var janeiro = ''
    var fevereiro = ''
    var marco = ''
    var abril = ''
    var maio = ''
    var junho = ''
    var julho = ''
    var agosto = ''
    var setembro = ''
    var outubro = ''
    var novembro = ''
    var dezembro = ''

    var dia
    var mestitulo
    var messel
    var mes
    var q = 0
    var ano = req.body.ano

    var tarefa
    var sql

    switch (String(req.body.mes)) {
        case 'Janeiro':
            janeiro = 'active'
            mestitulo = 'Janeiro '
            messel = '01'
            break;
        case 'Fevereiro':
            fevereiro = 'active'
            mestitulo = 'Fevereiro '
            messel = '02'
            break;
        case 'Março':
            marco = 'active'
            mestitulo = 'Março '
            messel = '03'
            break;
        case 'Abril':
            abril = 'active'
            mestitulo = 'Abril '
            messel = '04'
            break;
        case 'Maio':
            maio = 'active'
            mestitulo = 'Maio '
            messel = '05'
            break;
        case 'Junho':
            junho = 'active'
            mestitulo = 'Junho '
            messel = '06'
            break;
        case 'Julho':
            julho = 'active'
            mestitulo = 'Julho '
            messel = '07'
            break;
        case 'Agosto':
            agosto = 'active'
            mestitulo = 'Agosto '
            messel = '08'
            break;
        case 'Setembro':
            setembro = 'active'
            mestitulo = 'Setembro '
            messel = '09'
            break;
        case 'Outubro':
            outubro = 'active'
            mestitulo = 'Outubro '
            messel = '10'
            break;
        case 'Novembro':
            novembro = 'active'
            mestitulo = 'Novembro '
            messel = '11'
            break;
        case 'Dezembro':
            dezembro = 'active'
            mestitulo = 'Dezembro '
            messel = '12'
            break;
    }
    //console.log('req.body.selecionado=>' + req.body.selecionado)
    dataini = ano + '01' + '01'
    datafim = ano + '12' + '31'
    //console.log('dataini=>' + dataini)
    //console.log('datafim=>' + datafim)
    //console.log('req.body.pessoa=>' + req.body.pessoa)
    if (naoVazio(req.body.pessoa)) {
        //console.log('entrou')
        Pessoa.findOne({ user: id, _id: req.body.pessoa }).lean().then((pessoa) => {
            //console.log('pessoa=>' + pessoa)
            Tarefas.find({ user: id, servico: { $exists: true }, 'buscadataini': { $lte: parseFloat(datafim), $gte: parseFloat(dataini) } }).then((lista_tarefas) => {
                //console.log('tarefas=>' + tarefas)
                if (naoVazio(lista_tarefas)) {
                    lista_tarefas.forEach((e) => {
                        //console.log('e._id=>' + e._id)
                        Equipe.findOne({ user: id, id: e.equipe, ins0: { $exists: true }, dtinicio: { $ne: '00/00/0000' }, $or: [{ ins0: pessoa.nome }, { ins1: pessoa.nome }, { ins2: pessoa.nome }, { ins3: pessoa.nome }, { ins4: pessoa.nome }, { ins5: pessoa.nome }] }).then((equipe) => {
                            //console.log('e._id=>' + e._id)
                            Cliente.findOne({ _id: e.cliente }).then((cliente) => {
                                //console.log('cliente.nome=>' + cliente.nome)
                                //console.log('e.servico=>' + e.servico)
                                Servico.findOne({ _id: e.servico }).then((ser) => {
                                    //console.log('ser.descricao=>' + ser.descricao)
                                    var dias = []
                                    var feito = false
                                    dias = e.dias
                                    q++
                                    dtinicio = e.dataini
                                    //dtfim = e.datafim
                                    anoinicio = dtinicio.substring(0, 4)
                                    anofim = dtinicio.substring(0, 4)
                                    mesinicio = dtinicio.substring(5, 7)
                                    mesfim = dtinicio.substring(5, 7)
                                    diainicio = dtinicio.substring(8, 11)
                                    diafim = dtinicio.substring(8, 11)
                                    //console.log("messel=>" + messel)
                                    //console.log("mesinicio=>" + mesinicio)
                                    if (messel == mesinicio) {
                                        mes = mesinicio
                                        if (parseFloat(anofim) == parseFloat(anoinicio)) {
                                            dia = diainicio
                                            if (parseFloat(anofim) > parseFloat(anoinicio)) {
                                                //console.log('projeto ultrapassa anos')
                                                if (messel == 1 || messel == 3 || messel == 5 || messel == 7 || messel == 8 || messel == 10 || messel == 12) {
                                                    dif = 31
                                                } else {
                                                    dif = 30
                                                }
                                            } else {
                                                if (naoVazio(e.programacao)) {
                                                    dif = 1
                                                } else {
                                                    dif = parseFloat(diafim) - parseFloat(diainicio) + 1
                                                }
                                            }
                                        } else {
                                            //console.log('mesmo mes outro ano')
                                            //console.log('diainicio=>' + diainicio)
                                            if (naoVazio(e.programacao)) {
                                                dia = diainicio
                                                dif = 1
                                            } else {
                                                dif =
                                                    dia = 0
                                            }
                                        }
                                    } else {
                                        //console.log('diferente')
                                        if (naoVazio(e.programacao)) {
                                            dia = diainicio
                                            dif = 1
                                        } else {
                                            difmes = parseFloat(mesfim) - parseFloat(mesinicio)
                                            if (difmes != 0) {
                                                //console.log('difmes=>' + difmes)
                                                if (difmes < 0) {
                                                    difmes = difmes + 12
                                                }
                                                //console.log('mesinicio=>' + mesinicio)
                                                for (i = 0; i < difmes; i++) {
                                                    mes = parseFloat(mesinicio) + i
                                                    if (mes > 12) {
                                                        mes = mes - 12
                                                    }
                                                    //console.log('mes=>' + mes)
                                                    //console.log('meshoje=>' + meshoje)
                                                    if (mes == messel) {
                                                        break;
                                                    }
                                                }
                                                if (parseFloat(anofim) > parseFloat(anoinicio)) {
                                                    dia = '01'
                                                    if (messel == 1 || messel == 3 || messel == 5 || messel == 7 || messel == 8 || messel == 10 || messel == 12) {
                                                        dif = 31
                                                    } else {
                                                        dif = 30
                                                    }

                                                } else {
                                                    dia = diainicio
                                                    if (naoVazio(e.programacao)) {
                                                        dif = 1
                                                    } else {
                                                        dif = parseFloat(diafim) - parseFloat(diainicio) + 1
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    //console.log('dataini=>' + dataini)
                                    //console.log('mes=>' + mes)
                                    tarefa = ser.descricao
                                    for (i = 0; i < dif; i++) {
                                        //console.log('dia=>' + dia)
                                        //console.log('entrou laço')
                                        cor = 'lightgray'
                                        sql = { cliente: cliente.nome, id: e._id, tarefa, cor, concluido: e.concluido }
                                        if (messel == mes) {
                                            if (naoVazio(dias)) {
                                                //console.log('d=>' + d)
                                                feito = dias[i].feito
                                                //console.log('feito=>' + feito)
                                            }
                                            if (dia == '01') {
                                                dia01.push(sql)
                                            }
                                            if (dia == '02') {
                                                dia02.push(sql)
                                            }
                                            if (dia == '03') {
                                                dia03.push(sql)
                                            }
                                            if (dia == '04') {
                                                dia04.push(sql)
                                            }
                                            if (dia == '05') {
                                                dia05.push(sql)
                                            }
                                            if (dia == '06') {
                                                dia06.push(sql)
                                            }
                                            if (dia == '07') {
                                                dia07.push(sql)
                                            }
                                            if (dia == '08') {
                                                dia08.push(sql)
                                            }
                                            if (dia == '09') {
                                                dia09.push(sql)
                                            }
                                            if (dia == '10') {
                                                dia10.push(sql)
                                            }
                                            if (dia == '11') {
                                                dia11.push(sql)
                                            }
                                            if (dia == '12') {
                                                dia12.push(sql)
                                            }
                                            if (dia == '13') {
                                                dia13.push(sql)
                                            }
                                            if (dia == '14') {
                                                dia14.push(sql)
                                            }
                                            if (dia == '15') {
                                                dia15.push(sql)
                                            }
                                            if (dia == '16') {
                                                dia16.push(sql)
                                            }
                                            if (dia == '17') {
                                                dia17.push(sql)
                                            }
                                            if (dia == '18') {
                                                dia18.push(sql)
                                            }
                                            if (dia == '19') {
                                                dia19.push(sql)
                                            }
                                            if (dia == '20') {
                                                dia20.push(sql)
                                            }
                                            if (dia == '21') {
                                                dia21.push(sql)
                                            }
                                            if (dia == '22') {
                                                dia22.push(sql)
                                            }
                                            if (dia == '23') {
                                                dia23.push(sql)
                                            }
                                            if (dia == '24') {
                                                dia24.push(sql)
                                            }
                                            if (dia == '25') {
                                                dia25.push(sql)
                                            }
                                            if (dia == '26') {
                                                dia26.push(sql)
                                            }
                                            if (dia == '27') {
                                                dia27.push(sql)
                                            }
                                            if (dia == '28') {
                                                dia28.push(sql)
                                            }
                                            if (dia == '29') {
                                                dia29.push(sql)
                                            }
                                            if (dia == '30') {
                                                dia30.push(sql)
                                            }
                                            if (dia == '31') {
                                                dia31.push(sql)
                                            }
                                        }
                                        dia++
                                    }
                                    //console.log('tarefas.length=>' + tarefas.length)
                                    if (q == tarefas.length) {
                                        //console.log('messel=>' + messel)
                                        //console.log('ano=>' + ano)
                                        //console.log('mestitulo=>' + mestitulo)
                                        res.render('principal/agenda', {
                                            dia01, dia02, dia03, dia04, dia05, dia06, dia07,
                                            dia08, dia09, dia10, dia11, dia12, dia13, dia14,
                                            dia15, dia16, dia17, dia18, dia19, dia20, dia21,
                                            dia22, dia23, dia24, dia25, dia26, dia27, dia28,
                                            dia29, dia30, dia31,
                                            mes, anotitulo: ano, meshoje: messel, mestitulo, janeiro, fevereiro, marco, abril, maio, junho,
                                            julho, agosto, setembro, outubro, novembro, dezembro, tarefas: true
                                        })
                                    }
                                }).catch((err) => {
                                    req.flash('error_msg', 'Falha ao encontrar o tipo de serviço.')
                                    res.redirect('/gerenciamento/agenda')
                                })
                            }).catch((err) => {
                                req.flash('error_msg', 'Falha ao encontrar o cliente.')
                                res.redirect('/gerenciamento/agenda')
                            })
                        }).catch((err) => {
                            req.flash('error_msg', 'Falha ao encontrar a todas tarefas.')
                            res.redirect('/gerenciamento/agenda')
                        })
                    })
                } else {
                    var erros = []
                    erros.push({ texto: 'Pessoa sem tarefas para este período.' })
                    res.render('principal/agenda', {
                        dia01, dia02, dia03, dia04, dia05, dia06, dia07,
                        dia08, dia09, dia10, dia11, dia12, dia13, dia14,
                        dia15, dia16, dia17, dia18, dia19, dia20, dia21,
                        dia22, dia23, dia24, dia25, dia26, dia27, dia28,
                        dia29, dia30, dia31,
                        mes, anotitulo: ano, meshoje: messel, mestitulo, janeiro, fevereiro, marco, abril, maio, junho,
                        julho, agosto, setembro, outubro, novembro, dezembro, tarefas: true, erros
                    })
                }
            }).catch((err) => {
                req.flash('error_msg', 'Falha ao encontrar a todas tarefas.')
                res.redirect('/gerenciamento/agenda')
            })
        }).catch((err) => {
            req.flash('error_msg', 'Falha ao encontrar a pessoa.')
            res.redirect('/gerenciamento/agenda')
        })
    } else {
        Cliente.find({ user: id }).lean().then((todos_clientes) => {
            //console.log("dataini=>" + dataini)
            //console.log("datafim=>" + datafim)
            Tarefas.find({ user: id, servico: { $exists: true }, 'buscadataini': { $lte: parseFloat(datafim), $gte: parseFloat(dataini) } }).then((lista_tarefas) => {
                //console.log('lista_tarefas=>' + lista_tarefas)
                if (naoVazio(lista_tarefas)) {
                    lista_tarefas.forEach((e) => {
                        //console.log('e._id=>' + e._id)
                        //console.log('e.cliente=>' + e.cliente)
                        Cliente.findOne({ _id: e.cliente }).then((cliente) => {
                            //console.log('cliente=>' + cliente)
                            //console.log('e.servico=>' + e.servico)
                            Servico.findOne({ _id: e.servico }).then((ser) => {
                                var dias = []
                                var feito = false
                                dias = e.dias
                                q++
                                dtinicio = e.dataini
                                // dtfim = e.datafim
                                anoinicio = dtinicio.substring(0, 4)
                                anofim = dtinicio.substring(0, 4)
                                mesinicio = dtinicio.substring(5, 7)
                                mesfim = dtinicio.substring(5, 7)
                                diainicio = dtinicio.substring(8, 11)
                                diafim = dtinicio.substring(8, 11)
                                //console.log('e._id=>' + e._id)
                                //console.log("messel=>" + messel)
                                //console.log("mesinicio=>" + mesinicio)

                                if (messel == mesinicio) {
                                    mes = mesinicio
                                    if (parseFloat(anofim) == parseFloat(anoinicio)) {
                                        dia = diainicio
                                        if (parseFloat(anofim) > parseFloat(anoinicio)) {
                                            //console.log('projeto ultrapassa anos')
                                            if (messel == 1 || messel == 3 || messel == 5 || messel == 7 || messel == 8 || messel == 10 || messel == 12) {
                                                dif = 31
                                            } else {
                                                dif = 30
                                            }
                                        } else {
                                            if (naoVazio(e.programacao)) {
                                                dif = 1
                                            } else {
                                                dif = parseFloat(diafim) - parseFloat(diainicio) + 1
                                            }
                                        }
                                    } else {
                                        //console.log('mesmo mes outro ano')
                                        //console.log('diainicio=>' + diainicio)
                                        if (naoVazio(e.programacao)) {
                                            dia = diainicio
                                            dif = 1
                                        } else {
                                            dif =
                                                dia = 0
                                        }
                                    }
                                } else {
                                    //console.log('diferente')
                                    mes = 0
                                    if (naoVazio(e.programacao)) {
                                        dia = diainicio
                                        dif = 1
                                    } else {
                                        difmes = parseFloat(mesfim) - parseFloat(mesinicio)
                                        //console.log('difmes=>' + difmes)
                                        if (difmes != 0) {
                                            if (difmes < 0) {
                                                difmes = difmes + 12
                                            }
                                            //console.log('mesinicio=>' + mesinicio)
                                            for (i = 0; i < difmes; i++) {
                                                mes = parseFloat(mesinicio) + i
                                                if (mes > 12) {
                                                    mes = mes - 12
                                                }
                                                //console.log('mes=>' + mes)
                                                //console.log('meshoje=>' + meshoje)
                                                if (mes == messel) {
                                                    break;
                                                }
                                            }
                                            if (parseFloat(anofim) > parseFloat(anoinicio)) {
                                                dia = '01'
                                                if (messel == 1 || messel == 3 || messel == 5 || messel == 7 || messel == 8 || messel == 10 || messel == 12) {
                                                    dif = 31
                                                } else {
                                                    dif = 30
                                                }
                                            } else {
                                                dia = diainicio
                                                if (naoVazio(e.programacao)) {
                                                    dif = 1
                                                } else {
                                                    dif = parseFloat(diafim) - parseFloat(diainicio) + 1
                                                }
                                            }
                                        }
                                    }
                                }

                                const { dataini } = e
                                //console.log('dataini=>' + dataini)
                                //console.log('ser.descricao=>' + ser.descricao)
                                tarefa = ser.descricao
                                for (i = 0; i < dif; i++) {
                                    //console.log('dia=>' + dia)
                                    //console.log('entrou laço')
                                    cor = 'lightgray'
                                    sql = { cliente: cliente.nome, id: e._id, tarefa, cor, concluido: e.concluido }
                                    if (messel == mes) {
                                        if (naoVazio(dias)) {
                                            //console.log('d=>' + d)
                                            feito = dias[i].feito
                                            //console.log('feito=>' + feito)
                                        }
                                        if (dia == '01') {
                                            dia01.push(sql)
                                        }
                                        if (dia == '02') {
                                            dia02.push(sql)
                                        }
                                        if (dia == '03') {
                                            dia03.push(sql)
                                        }
                                        if (dia == '04') {
                                            dia04.push(sql)
                                        }
                                        if (dia == '05') {
                                            dia05.push(sql)
                                        }
                                        if (dia == '06') {
                                            dia06.push(sql)
                                        }
                                        if (dia == '07') {
                                            dia07.push(sql)
                                        }
                                        if (dia == '08') {
                                            dia08.push(sql)
                                        }
                                        if (dia == '09') {
                                            dia09.push(sql)
                                        }
                                        if (dia == '10') {
                                            dia10.push(sql)
                                        }
                                        if (dia == '11') {
                                            dia11.push(sql)
                                        }
                                        if (dia == '12') {
                                            dia12.push(sql)
                                        }
                                        if (dia == '13') {
                                            dia13.push(sql)
                                        }
                                        if (dia == '14') {
                                            dia14.push(sql)
                                        }
                                        if (dia == '15') {
                                            dia15.push(sql)
                                        }
                                        if (dia == '16') {
                                            dia16.push(sql)
                                        }
                                        if (dia == '17') {
                                            dia17.push(sql)
                                        }
                                        if (dia == '18') {
                                            dia18.push(sql)
                                        }
                                        if (dia == '19') {
                                            dia19.push(sql)
                                        }
                                        if (dia == '20') {
                                            dia20.push(sql)
                                        }
                                        if (dia == '21') {
                                            dia21.push(sql)
                                        }
                                        if (dia == '22') {
                                            dia22.push(sql)
                                        }
                                        if (dia == '23') {
                                            dia23.push(sql)
                                        }
                                        if (dia == '24') {
                                            dia24.push(sql)
                                        }
                                        if (dia == '25') {
                                            dia25.push(sql)
                                        }
                                        if (dia == '26') {
                                            dia26.push(sql)
                                        }
                                        if (dia == '27') {
                                            dia27.push(sql)
                                        }
                                        if (dia == '28') {
                                            dia28.push(sql)
                                        }
                                        if (dia == '29') {
                                            dia29.push(sql)
                                        }
                                        if (dia == '30') {
                                            dia30.push(sql)
                                        }
                                        if (dia == '31') {
                                            dia31.push({ projeto: cliente.nome, ehManutencao: true, id: e._id, tarefa, feito })
                                        }
                                    }
                                    dia++
                                }
                                //console.log('lista_tarefas.length=>' + lista_tarefas.length)
                                if (q == lista_tarefas.length) {
                                    //console.log('messel=>' + messel)
                                    //console.log('ano=>' + ano)
                                    //console.log('mestitulo=>' + mestitulo)
                                    res.render('principal/agenda', {
                                        dia01, dia02, dia03, dia04, dia05, dia06, dia07,
                                        dia08, dia09, dia10, dia11, dia12, dia13, dia14,
                                        dia15, dia16, dia17, dia18, dia19, dia20, dia21,
                                        dia22, dia23, dia24, dia25, dia26, dia27, dia28,
                                        dia29, dia30, dia31,
                                        mes, anotitulo: ano, meshoje: messel, mestitulo, janeiro, fevereiro, marco, abril, maio, junho,
                                        julho, agosto, setembro, outubro, novembro, dezembro, tarefas: true
                                    })
                                }
                            })
                        })
                    })
                } else {
                    if (q == lista_tarefas.length) {
                        //console.log('mestitulo=>' + mestitulo)
                        res.render('principal/agenda', {
                            dia01, dia02, dia03, dia04, dia05, dia06, dia07,
                            dia08, dia09, dia10, dia11, dia12, dia13, dia14,
                            dia15, dia16, dia17, dia18, dia19, dia20, dia21,
                            dia22, dia23, dia24, dia25, dia26, dia27, dia28,
                            dia29, dia30, dia31,
                            mes, anotitulo: ano, meshoje, mestitulo, janeiro, fevereiro, marco, abril, maio, junho,
                            julho, agosto, setembro, outubro, novembro, dezembro, tarefas: true
                        })
                    }
                }
            }).catch((err) => {
                req.flash('error_msg', 'Não foi possível encontrar o tarefas cadastradas neste mês e ano.')
                res.redirect('/gerenciamento/agenda/')
            })
        })
    }
})

router.post('/addAtvPadrao', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    var id

    if (typeof user == 'undefined') {
        id = _id
    }
    const corpo = {
        user: id,
        descricao: req.body.descricao
    }
    new AtvPadrao(corpo).save().then(() => {
        req.flash('success_msg', 'Atividade padrão cadastrada.')
        res.redirect('/gerenciamento/atividadesPadrao')
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar as atividades padrão.')
        res.redirect('/gerenciamento/atividadesPadrao/')
    })
})

router.post('/salvarsrv', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    var id

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }
    if (req.body.id == '') {
        new Servico({
            user: id,
            descricao: req.body.descricao,
            classe: req.body.classe,
            data: dataHoje()
        }).save().then(() => {
            req.flash('success_msg', 'Serviço criado com sucesso.')
            res.redirect('/gerenciamento/servicos')
        }).catch((err) => {
            req.flash('error_msg', 'Falha ao salvar o tipo de serviço.')
        })
    } else {
        Servico.findOne({ _id: req.body.id }).then((servico) => {
            servico.descricao = req.body.descricao
            servico.classe = req.body.classe
            servico.save().then(() => {
                req.flash('success_msg', 'Serviço salvo com sucesso.')
                res.redirect('/gerenciamento/servicos')
            }).catch((err) => {
                req.flash('error_msg', 'Falha ao salvar o tipo de serviço.')
            })
        }).catch((err) => {
            req.flash('error_msg', 'Falha ao encontrar o tipo de serviço.')
        })

    }
})

router.get('/editarsrv/:id', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    var id

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }
    Servico.find({ user: id }).lean().then((servicos) => {
        Servico.findOne({ _id: req.params.id }).lean().then((servico) => {
            //     //console.log(servico)
            res.render('principal/servicos', { servicos, servico })
        }).catch((err) => {
            req.flash('error_msg', 'Falha ao encontrar o tipo de serviço.')
            res.redirect('/gerenciamento/servicos')
        })
    }).catch((err) => {
        req.flash('error_msg', 'Falha ao encontrar todos os tipos de serviço.')
        res.redirect('/gerenciamento/servicos')
    })
})

router.get('/leads', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    const { pessoa } = req.user
    const { vendedor } = req.user
    var id
    var idpes
    var sql = {}
    var clientes = []
    var q = 0

    if (naoVazio(user)) {
        id = user
        idpes = pessoa
        if (vendedor == true) {
            sql = { user: id, vendedor: idpes, lead: true }
        } else {
            sql = { user: id, lead: true }
        }
    } else {
        id = _id
        sql = { user: id, lead: true }
    }
    Cliente.find(sql).lean().then((cliente) => {
        if (naoVazio(cliente)) {
            cliente.forEach((e) => {
                Pessoa.findOne({ _id: e.vendedor }).then((vendedor) => {
                    clientes.push({ _id: e._id, nome: e.nome, cidade: e.cidade, uf: e.uf, contato: e.contato, celular: e.celular, vendedor: vendedor.nome })
                    q++
                    if (q == cliente.length) {
                        res.render('cliente/consulta', { clientes, tipo: 'lead' })
                    }
                }).catch((err) => {
                    req.flash('error_msg', 'Não foi possível encontrar os vendedores.')
                    res.redirect('/dashboard')
                })
            })
        } else {
            res.render('cliente/consulta')
        }
    }).catch((err) => {
        req.flash('error_msg', 'Nenhum cliente encontrado.')
        res.redirect('/cliente/consulta')
    })
})

router.get('/assistencia', ehAdmin, (req, res) => {
    const { pessoa } = req.user
    var q = 0
    var lista = []
    //console.log('pessoa=>' + pessoa)
    Tarefas.find({ responsavel: pessoa, tipo: 'assistencia', concluido: false }).then((tarefa) => {
        //console.log('tarefa=>' + tarefa)
        if (naoVazio(tarefa)) {
            tarefa.forEach((e) => {
                Servico.findOne({ _id: e.servico }).then((servico) => {
                    q++
                    lista.push({ id: e._id, seq: e.seq, observacao: e.observacao, selecionado: e.selecionado, descricao: servico.descricao, data: dataMensagem(e.dataini), endereco: e.endereco, numero: e.numero, complemento: e.complemento, uf: e.uf, cidade: e.cidade })
                    //console.log('q=>' + q)
                    //console.log('tarefa.length=>' + tarefa.length)
                    if (q == tarefa.length) {
                        lista.sort(comparaNum)
                        res.render('principal/assistencia', { lista })
                    }
                }).catch((err) => {
                    req.flash('error_msg', 'Nenhuma serviço encontrado.')
                    res.redirect('/cliente/consulta')
                })
            })
        } else {
            res.render('principal/assistencia')
        }
    }).catch((err) => {
        req.flash('error_msg', 'Nenhuma tarefa encontrada.')
        res.redirect('/dashboard')
    })
})

router.get('/tarefa/:id', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    var id
    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }

    var trf_empresa
    var trf_empid
    var trf_servico
    var trf_srvid
    var trf_dataini

    //console.log('req.params.id=>' + req.params.id)
    Tarefas.findOne({ _id: req.params.id }).lean().then((tarefa) => {
        trf_dataini = dataMensagem(tarefa.dataini)
        Empresa.findOne({ _id: tarefa.empresa }).lean().then((trfemp) => {
            trf_empresa = trfemp.nome
            trf_empid = trfemp._id
            Servico.findOne({ _id: tarefa.servico }).then((trfsrv) => {
                trf_servico = trfsrv.descricao
                trf_srvid = trfsrv._id
                Equipe.findOne({ _id: tarefa.equipe }).then((equipeins) => {
                    Cliente.findOne({ _id: tarefa.cliente }).lean().then((trf_cliente) => {
                        if (naoVazio(equipeins)) {
                            Empresa.find({ user: id }).lean().then((empresa) => {
                                Cliente.find({ user: id }).lean().then((cliente) => {
                                    //console.log('req.body.cliente=>' + req.body.cliente)
                                    Servico.find({ user: id }).lean().then((servicos) => {
                                        Pessoa.find({ user: id, 'funass': 'checked' }).lean().then((assistencia) => {
                                            if (naoVazio(assistencia)) {
                                                //console.log('tarefa.responsavel=>' + tarefa.responsavel)
                                                Pessoa.findOne({ _id: tarefa.responsavel }).lean().then((trf_tecnico) => {
                                                    //console.log('trf_tecnico=>' + trf_tecnico)
                                                    if (naoVazio(trf_tecnico)) {
                                                        res.render('principal/tarefas', { tarefa, trf_empresa, trf_empid, trfemp, trf_tecnico, assistencia, trf_servico, trf_srvid, trf_cliente, cliente, servicos, empresa })
                                                    } else {
                                                        res.render('principal/tarefas', { tarefa, trf_empresa, trf_empid, trfemp, trf_servico, assistencia, trf_srvid, trf_cliente, cliente, servicos, empresa })
                                                    }
                                                }).catch((err) => {
                                                    req.flash('error_msg', 'Nenhuma responsavel pela tarefa encontrado.')
                                                    res.redirect('/gerenciamento/agenda')
                                                })
                                            } else {
                                                req.flash('error_msg', 'Nenhuma técnico cadastrado.')
                                                res.redirect('/pessoa/novo')
                                            }
                                        }).catch((err) => {
                                            req.flash('error_msg', 'Nenhuma responsavel pela tarefa encontrado.')
                                            res.redirect('/gerenciamento/agenda')
                                        })
                                    }).catch((err) => {
                                        req.flash('error_msg', 'Nenhuma tipo de serviço cadastrado.')
                                        res.redirect('/gerenciamento/agenda')
                                    })
                                }).catch((err) => {
                                    req.flash('error_msg', 'Falha ao encontrar o cliente.')
                                    res.redirect('/gerenciamento/orcamento/' + req.params.id)
                                })
                            }).catch((err) => {
                                req.flash('error_msg', 'Nehuam empresa cadastrada.')
                                res.redirect('/confguracao/addempresa')
                            })
                        }
                    }).catch((err) => {
                        req.flash('error_msg', 'Falha ao encontrar o cliente da tarefa.')
                        res.redirect('/gerenciamento/orcamento/' + req.params.id)
                    })
                }).catch((err) => {
                    req.flash('error_msg', 'Falha ao encontrar a equipe.')
                    res.redirect('/gerenciamento/orcamento/' + req.params.id)
                })
            }).catch((err) => {
                req.flash('error_msg', 'Nenhum tipo de serviço encontrado.')
                res.redirect('/cliente/consulta')
            })
        }).catch((err) => {
            req.flash('error_msg', 'Nenhuma empresa encontrada.')
            res.redirect('/cliente/consulta')
        })
    }).catch((err) => {
        req.flash('error_msg', 'Nenhuma tarefa encontrada.')
        res.redirect('/cliente/consulta')
    })
})

router.post('/selecionacliente', ehAdmin, (req, res) => {
    const { _id } = req.user
    Cliente.find({ user: id }).lean().then((cliente) => {
        var ehSelecao = true
        res.render('projeto/gerenciamento/tarefa', { cliente, ehSelecao })
    }).catch(() => {
        res.flash('error_msg', 'Não há cliente cadastrado.')
        req.redirect('/agenda')
    })
})

router.post('/addmanutencao', ehAdmin, (req, res) => {
    var id
    const { _id } = req.user
    const { user } = req.user
    if (naoVazio(user)) {
        id = user
    } else {
        id = _id
    }

    var data = ''
    var dia = ''
    var ano = ''
    var ins_fora = []
    var q = 0
    var ehSelecao = false
    var mes = ''

    var hoje = req.body.date
    ano = String(hoje).substring(0, 4)
    mes = String(hoje).substring(5, 7)
    dia = String(hoje).substring(8, 10)
    if (parseFloat(dia) < 10) {
        dia = '0' + dia
    }

    var nome
    var id
    var idcliente
    data = req.body.data
    //console.log('data=>' + data)
    Empresa.findOne({ user: id }).lean().then((trfemp) => {
        if (naoVazio(trfemp)) {
            //console.log('req.body.cliente=>' + req.body.cliente)
            Servico.find({ user: id }).lean().then((servicos) => {
                if (naoVazio(servicos)) {
                    //console.log('check=>' + req.body.check)
                    if (req.body.check != 'on') {
                        idcliente = '111111111111111111111111'
                    } else {
                        idcliente = req.body.cliente
                    }
                    //console.log('idcliente=>' + idcliente)
                    Usina.find({ cliente: idcliente }).lean().then((usina) => {
                        //console.log('usina=>' + usina)
                        if (naoVazio(usina)) {
                            //console.log(usina)
                            Pessoa.find({ user: id, $or: [{ 'funins': 'checked' }, { 'funele': 'checked' }] }).sort({ 'nome': 'asc' }).lean().then((instalacao) => {
                                if (naoVazio(instalacao)) {
                                    instalacao.forEach((pesins) => {
                                        q++
                                        nome = pesins.nome
                                        ins_fora.push({ id: pesins._id, nome })
                                        if (q == instalacao.length) {
                                            Pessoa.find({ user: id, 'funges': 'checked' }).sort({ 'nome': 'asc' }).lean().then((gestor) => {
                                                //console.log('gestor=>' + gestor)
                                                res.render('principal/tarefas', { data, usina, ins_fora, servicos, cliente: idcliente, instalacao, gestor, empresa })
                                            }).catch((err) => {
                                                req.flash('error_msg', 'Falha ao encontrar os gestores.')
                                                res.redirect('/gerenciamento/agenda')
                                            })
                                        }
                                    })
                                } else {
                                    req.flash('error_msg', 'Não existem técnicos cadastrados.')
                                    res.redirect('/gerenciamento/agenda')
                                }
                            }).catch((err) => {
                                req.flash('error_msg', 'Falha ao encontrar os técnicos.')
                                res.redirect('/gerenciamento/agenda')
                            })
                        } else {
                            //console.log('sem usina')
                            // Pessoa.find({ user: id, 'funins': 'checked' }).sort({ 'nome': 'asc' }).lean().then((instalacao) => {
                            //     if (naoVazio(instalacao)) {
                            //         instalacao.forEach((pesins) => {
                            //             q++
                            //             nome = pesins.nome
                            //             ins_fora.push({ id: pesins._id, nome })
                            //             if (q == instalacao.length) {
                            //                 //console.log('id=>' + id)
                            Cliente.find({ user: id }).lean().then((cliente) => {
                                Pessoa.find({ user: id, 'funges': 'checked' }).sort({ 'nome': 'asc' }).lean().then((gestor) => {
                                    Pessoa.find({ user: id, 'funass': 'checked' }).lean().then((assistencia) => {
                                        if (naoVazio(assistencia)) {
                                            res.render('principal/tarefas', { data, servicos, cliente, gestor, trfemp, assistencia })
                                        } else {
                                            req.flash('error_msg', 'Nenhuma técnico cadstrado.')
                                            res.redirect('/pessoa/novo')
                                        }
                                    }).catch((err) => {
                                        req.flash('error_msg', 'Falha ao encontrar as pessoas.')
                                        res.redirect('/gerenciamento/agenda')
                                    })
                                }).catch((err) => {
                                    req.flash('error_msg', 'Falha ao encontrar os gestores.')
                                    res.redirect('/gerenciamento/agenda')
                                })
                            }).catch((err) => {
                                req.flash('error_msg', 'Falha ao encontrar o cliente.')
                                res.redirect('/gerenciamento/agenda')
                            })
                            //         }
                            //     })
                            // } else {
                            //     req.flash('error_msg', 'Não existem técnicos cadastrados.')
                            //     res.redirect('/gerenciamento/agenda')
                            // }
                            // }).catch((err) => {
                            //     req.flash('error_msg', 'Falha ao encontrar os técnicos.')
                            //     res.redirect('/gerenciamento/agenda')
                            // })
                        }
                    }).catch((err) => {
                        req.flash('error_msg', 'Nenhuma usina cadastrada.')
                        res.redirect('/gerenciamento/agenda')
                    })
                } else {
                    req.flash('error_msg', 'Não existem serviços cadastradas.')
                    res.redirect('/gerenciamento/agenda')
                }
            }).catch((err) => {
                req.flash('error_msg', 'Nenhuma tipo de serviço cadastrado.')
                res.redirect('/gerenciamento/agenda')
            })
        } else {
            req.flash('error_msg', 'Cadastre uma empresa para continuar.')
            res.redirect('/confguracao/addempresa')
        }
    }).catch((err) => {
        req.flash('error_msg', 'Nenhuma empresa cadastrada.')
        res.redirect('/confguracao/addempresa')
    })
})

router.post('/addtarefa', ehAdmin, (req, res) => {
    var id
    const { _id } = req.user
    const { user } = req.user
    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }

    var adiciona
    var dataini
    var datafim
    var dif
    var dias = []
    var cadastro = dataHoje()
    var corpo = []
    var email = []
    var todos_emails = ''
    var equipe = []
    var email = ''

    var cep = ''
    var cidade = ''
    var uf = ''
    var endereco = ''
    var numero = ''
    var bairro = ''
    var complemento = ''

    //console.log('req.body.id=>' + req.body.id)
    if (naoVazio(req.body.id)) {
        Tarefas.findOne({ _id: req.body.id }).then((tarefa) => {
            //console.log('equipe=>' + tarefa.equipe)
            Equipe.findOne({ _id: tarefa.equipe }).then((equipe) => {
                //console.log('equipe=>' + equipe)
                dataini = req.body.dataini
                datafim = req.body.datafim
                //console.log('req.body.checkres=>' + req.body.checkres)
                //console.log('dataini=>' + dataini)
                //console.log('datafim=>' + datafim)

                if (naoVazio(dataini) && naoVazio(datafim)) {
                    var data1 = new Date(dataini)
                    var data2 = new Date(datafim)
                    dif = Math.abs(data2.getTime() - data1.getTime())
                    days = Math.ceil(dif / (1000 * 60 * 60 * 24))
                    days = days + 1
                    //console.log('days=>' + days)
                    for (i = 1; i < days + 1; i++) {
                        dias.push({ dia: i, feito: false })
                    }
                    tarefa.dias = dias
                }
                tarefa.cliente = req.body.cliente
                tarefa.observacao = req.body.observacao
                tarefa.endereco = buscaPrimeira(req.body.endereco)
                tarefa.numero = req.body.numero
                tarefa.bairro = req.body.bairro
                tarefa.cep = req.body.cep
                tarefa.complemento = req.body.complemento
                tarefa.cidade = req.body.cidade
                tarefa.uf = req.body.uf
                //console.log('req.body.manutencao=>' + req.body.manutencao)
                tarefa.servico = req.body.manutencao
                tarefa.dataini = dataini
                tarefa.buscadataini = dataBusca(dataini)
                // tarefa.datafim = datafim
                // tarefa.buscadatafim = dataBusca(datafim)
                tarefa.preco = req.body.preco
                if (req.body.checkres != null) {
                    tarefa.responsavel = req.body.responsavel
                }
                tarefa.save().then(() => {
                    // equipe.ins0 = req.body.ins0
                    // equipe.ins1 = req.body.ins1
                    // equipe.ins2 = req.body.ins2
                    // equipe.ins3 = req.body.ins3
                    // equipe.ins4 = req.body.ins4
                    // equipe.ins5 = req.body.ins5
                    //console.log('tarefa salva')
                    if (req.body.checkres != null) {
                        equipe.insres = req.body.responsavel
                    }
                    equipe.dtinicio = req.body.dataini
                    // equipe.dtfim = req.body.datafim
                    equipe.dtinibusca = dataBusca(req.body.dataini)
                    // equipe.dtfimbusca = dataBusca(req.body.datafim)
                    equipe.save().then(() => {
                        req.flash('success_msg', 'Tarefa salva com sucesso.')
                        if (naoVazio(tarefa.programacao)) {
                            res.redirect('/cliente/programacao/' + req.body.idusina)
                        } else {
                            res.redirect('/gerenciamento/tarefa/' + tarefa._id)
                        }
                    }).catch((err) => {
                        req.flash('error_msg', 'Houve erro ao salvar a equipe.')
                        res.redirect('/gerenciamento/tarefa/' + tarefa._id)
                    })
                }).catch((err) => {
                    req.flash('error_msg', 'Houve erro ao salvar a tarefa.')
                    res.redirect('/gerenciamento/tarefa/' + tarefa._id)
                })
            }).catch((err) => {
                req.flash('error_msg', 'Houve erro ao encontrar a equipe.')
                res.redirect('/gerenciamento/tarefa/' + tarefa._id)
            })
        }).catch((err) => {
            req.flash('error_msg', 'Houve erro ao encontrar a projeto.')
            res.redirect('/gerenciamento/tarefa/' + tarefa._id)
        })
    } else {
        //console.log('equipe true')
        dataini = req.body.dataini
        // datafim = req.body.datafim
        //console.log('email=>' + email)
        for (i = 0; i < email.length; i++) {
            //console.log('custoins[i]' + custoins[i])
            todos_emails = todos_emails + email[i] + ';'
        }
        //console.log('req.body.ins0=>' + req.body.ins0)
        corpo = {
            user: id,
            inres: req.body.responsavel,
            dtinicio: req.body.dataini,
            // dtfim: req.body.datafim,
            dtinibusca: dataBusca(req.body.dataini),
            // dtfimbusca: dataBusca(req.body.datafim),
            feito: false,
            liberar: false,
            parado: false,
            //email: todos_emails
        }

        if (req.body.checkres != null) {
            Object.assign(equipe, { insres: req.body.responsavel }, corpo)
        } else {
            equipe = corpo
        }

        new Equipe(equipe).save().then(() => {
            //console.log('salvou equipe')
            Equipe.findOne({ user: id }).sort({ field: 'asc', _id: -1 }).then((novaequipe) => {
                Empresa.findOne({ _id: req.body.empresa }).then((emp_tarefa) => {
                    //console.log('encontrou empresa')
                    //console.log('req.body.cliente=>' + req.body.cliente)
                    Cliente.findOne({ _id: req.body.cliente }).then((cliente) => {
                        //console.log("dias=>" + dias)
                        if (naoVazio(req.body.cep)) {
                            cep = req.body.cep
                        } else {
                            cep = cliente.cep
                        }
                        if (naoVazio(req.body.cidade)) {
                            cidade = req.body.cidade
                        } else {
                            cidade = cliente.cidade
                        }
                        if (naoVazio(req.body.uf)) {
                            uf = req.body.uf
                        } else {
                            uf = cliente.uf
                        }
                        if (naoVazio(req.body.endereco)) {
                            endereco = req.body.endereco
                        } else {
                            endereco = cliente.endereco
                        }
                        if (naoVazio(req.body.numero)) {
                            numero = req.body.numero
                        } else {
                            numero = cliente.numero
                        }
                        if (naoVazio(req.body.bairro)) {
                            bairro = req.body.bairro
                        } else {
                            bairro = cliente.bairro
                        }
                        if (naoVazio(req.body.complemento)) {
                            complemento = req.body.complemento
                        } else {
                            complemento = cliente.complemento
                        }
                        corpo = {
                            user: id,
                            equipe: novaequipe._id,
                            cliente: req.body.cliente,
                            observacao: req.body.observacao,
                            empresa: req.body.empresa,
                            endereco: endereco,
                            numero: numero,
                            bairro: bairro,
                            cep: cep,
                            complemento: complemento,
                            cidade: cidade,
                            uf: uf,
                            servico: req.body.manutencao,
                            dataini: dataini,
                            buscadataini: dataBusca(dataini),
                            cadastro: dataBusca(cadastro),
                            preco: req.body.preco,
                            concluido: false,
                            selecionado: false,
                            tipo: 'assistencia',
                            emandamento: false
                        }
                        var tarefa = []
                        //console.log('req.body.responsavel=>' + req.body.responsavel)
                        if (naoVazio(req.body.responsavel)) {
                            //console.log('tarefa=>' + JSON.stringify(corpo))
                            Object.assign(tarefa, { responsavel: req.body.responsavel }, corpo)
                        } else {
                            tarefa = corpo
                        }
                        //console.log('tarefa=>' + JSON.stringify(tarefa))
                        var seq
                        Tarefas.findOne({ user: id, tipo: 'assistencia' }).sort({ field: 'asc', _id: -1 }).then((tarefa_seq) => {
                            //console.log('tarefa_seq=>' + JSON.stringify(tarefa_seq))
                            if (naoVazio(tarefa_seq)) {
                                seq = tarefa_seq.seq + 1
                            } else {
                                seq = 1
                            }
                            new Tarefas(tarefa).save().then(() => {
                                //console.log("salvou tarefa")
                                Tarefas.findOne({ user: id, tipo: 'assistencia' }).sort({ field: 'asc', _id: -1 }).then((tarefa) => {
                                    emp_tarefa.save().then(() => {
                                        //console.log('novaequipe._id=>' + novaequipe._id)
                                        //console.log(tarefa._id)
                                        novaequipe.tarefa = tarefa._id
                                        novaequipe.save().then(() => {
                                            tarefa.seq = seq
                                            tarefa.save().then(() => {
                                                req.flash('success_msg', 'Tarefa gerada com sucesso.')
                                                res.redirect('/gerenciamento/tarefa/' + tarefa._id)
                                            }).catch((err) => {
                                                req.flash('error_msg', 'Falha ao salvar a tarefa.')
                                                res.redirect('/gerenciamento/tarefa/' + tarefa._id)
                                            })
                                        })
                                    }).catch((err) => {
                                        req.flash('error_msg', 'Falha ao salvar a empresa.')
                                        res.redirect('/gerenciamento/tarefa/' + tarefa._id)
                                    })
                                }).catch((err) => {
                                    req.flash('error_msg', 'Falha ao encontrar a tarefa.')
                                    res.redirect('/gerenciamento/tarefa/' + tarefa._id)
                                })
                            }).catch((err) => {
                                req.flash('error_msg', 'Falha ao salvar a tarefa.')
                                res.redirect('/gerenciamento/tarefa' + tarefa._id)
                            })
                        }).catch((err) => {
                            req.flash('error_msg', 'Falha ao encontrar a última tarefa.')
                            res.redirect('/gerenciamento/agenda')
                        })
                    }).catch((err) => {
                        req.flash('error_msg', 'Falha ao encontrar o cliente.')
                        res.redirect('/gerenciamento/tarefa' + tarefa._id)
                    })
                }).catch((err) => {
                    req.flash('error_msg', 'Falha ao encontrar a empresa.')
                    res.redirect('/gerenciamento/tarefa/' + tarefa._id)
                })
            }).catch((err) => {
                req.flash('error_msg', 'Falha ao encontrar a equipe.')
                res.redirect('/gerenciamento/tarefa/' + tarefa._id)
            })
        }).catch((err) => {
            req.flash('error_msg', 'Falha ao salvar a equipe.')
            res.redirect('/gerenciamento/tarefa/' + tarefa._id)
        })
    }
})

router.post('/aplicarcenario/', ehAdmin, (req, res) => {
    var modtam1 = 0
    var modtam2 = 0
    var modtam3 = 0
    var qtdmax1 = 0
    var qtdmax2 = 0
    var qtdmax3 = 0
    var kwpmax1 = 0
    var kwpmax2 = 0
    var kwpmax3 = 0
    var aviso1 = false
    var aviso2 = false
    var aviso3 = false
    var area = req.body.area

    modtam1 = parseFloat(req.body.modtmc1) * parseFloat(req.body.modtml1)
    modtam2 = parseFloat(req.body.modtmc2) * parseFloat(req.body.modtml2)
    modtam3 = parseFloat(req.body.modtmc3) * parseFloat(req.body.modtml3)
    qtdmax1 = Math.round(parseFloat(area) / parseFloat(modtam1))
    qtdmax2 = Math.round(parseFloat(area) / parseFloat(modtam2))
    qtdmax3 = Math.round(parseFloat(area) / parseFloat(modtam3))
    kwpmax1 = (parseFloat(qtdmax1) * parseFloat(req.body.modkwp1)) / parseFloat(1000)
    kwpmax2 = (parseFloat(qtdmax2) * parseFloat(req.body.modkwp2)) / parseFloat(1000)
    kwpmax3 = (parseFloat(qtdmax3) * parseFloat(req.body.modkwp3)) / parseFloat(1000)
    var texto1
    var texto2
    var texto3
    if (parseFloat(kwpmax1) < parseFloat(req.body.kwpsis)) {
        texto1 = 'A potência nominal do sistema é maior que a potência do cenário 1.'
    } else {
        texto1 = 'Cenário 1 compatível com o espaço disponível para a instalação da UFV.'
    }
    if (parseFloat(kwpmax2) < parseFloat(req.body.kwpsis)) {
        texto2 = 'A potência nominal do sistema é maior que a potência do cenário 2.'
    } else {
        texto2 = 'Cenário 2 compatível com o espaço disponível para a instalação da UFV.'
    }
    if (parseFloat(kwpmax3) < parseFloat(req.body.kwpsis)) {
        texto3 = 'A potência nominal do sistema é maior que a potência do cenário 3.'
    } else {
        texto3 = 'Cenário 3 compatível com o espaço disponível para a instalação da UFV.'
    }

    res.render('projeto/gerenciamento/cenarios', {
        modkwp1: req.body.modkwp1, modqtd1: req.body.modqtd1, modtmc1: req.body.modtmc1, modtml1: req.body.modtml1,
        modkwp2: req.body.modkwp2, modqtd2: req.body.modqtd2, modtmc2: req.body.modtmc2, modtml2: req.body.modtml2,
        modkwp3: req.body.modkwp3, modqtd3: req.body.modqtd3, modtmc3: req.body.modtmc3, modtml3: req.body.modtml3,
        kwpmax1, kwpmax2, kwpmax3, qtdmax1, qtdmax2, qtdmax3, kwpmax1, kwpmax2, kwpmax3, kwpsis: req.body.kwpsis,
        area, texto1, texto2, texto3
    })
})

router.post('/vermais/', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    var id

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }

    var dia01 = []
    var dia02 = []
    var dia03 = []
    var dia04 = []
    var dia05 = []
    var dia06 = []
    var dia07 = []
    var dia08 = []
    var dia09 = []
    var dia10 = []
    var dia11 = []
    var dia12 = []
    var dia13 = []
    var dia14 = []
    var dia15 = []
    var dia16 = []
    var dia17 = []
    var dia18 = []
    var dia19 = []
    var dia20 = []
    var dia21 = []
    var dia22 = []
    var dia23 = []
    var dia24 = []
    var dia25 = []
    var dia26 = []
    var dia27 = []
    var dia28 = []
    var dia29 = []
    var dia30 = []
    var dia31 = []
    var params_dia = []
    var todasCores = []

    const cores = ['green', 'blue', 'tomato', 'teal', 'sienna', 'salmon', 'mediumpurple', 'rebeccapurple', 'yellowgreen', 'peru', 'cadetblue', 'coral', 'cornflowerblue', 'crimson', 'darkblue', 'darkcyan', 'orange', 'hotpink']

    var dtcadastro = '00000000'
    var dtinicio = ''
    var q = 0
    var anoinicio
    var anofim
    var mesinicio
    var mesfim
    var diainicio
    var diafim
    var hoje
    var meshoje
    var mestitulo
    var anotitulo
    var dia
    var mes
    var dif
    var difmes
    var y = 0
    var x = -1
    var z = -1
    var inicio
    var fim
    var con1
    var con2
    var data1
    var data2
    var days
    var dif1

    var janeiro
    var fevereiro
    var marco
    var abril
    var maio
    var junho
    var julho
    var agosto
    var setembro
    var outubro
    var novembro
    var dezembro

    var hoje = dataHoje()
    var meshoje = hoje.substring(5, 7)
    var anotitulo = hoje.substring(0, 4)

    //console.log('meshoje=>' + meshoje)
    var mestitulo = req.body.mes

    switch (mestitulo) {
        case 'Janeiro':
            janeiro = 'active'
            meshoje = '01'
            break;
        case 'Fevereiro':
            fevereiro = 'active'
            meshoje = '02'
            bisexto = true
            break;
        case 'Março':
            marco = 'active'
            meshoje = '03'
            break;
        case 'Abril':
            abril = 'active'
            meshoje = '04'
            break;
        case 'Maio':
            maio = 'active'
            meshoje = '05'
            break;
        case 'Junho':
            junho = 'active'
            meshoje = '06'
            break;
        case 'Julho':
            julho = 'active'
            meshoje = '07'
            break;
        case 'Agosto':
            agosto = 'active'
            meshoje = '08'
            break;
        case 'Setembro':
            setembro = 'active'
            meshoje = '09'
            break;
        case 'Outubro':
            outubro = 'active'
            meshoje = '10'
            break;
        case 'Novembro':
            novembro = 'active'
            meshoje = '11'
            break;
        case 'Dezembro':
            dezembro = 'active'
            meshoje = '12'
            break;
    }
    dataini = String(anotitulo) + meshoje + '01'
    datafim = String(anotitulo) + meshoje + '30'
    dataini = parseFloat(dataini)
    datafim = parseFloat(datafim)
    //console.log('anotitulo=>' + anotitulo)
    //console.log('meshoje=>' + meshoje)
    //console.log('mestitulo=>' + mestitulo)
    //console.log('dataini=>' + dataini)
    //console.log('datafim=>' + datafim)
    var sql = {}
    sql = { user: id, feito: true, liberar: true, prjfeito: false, tarefa: { $exists: false }, insres: req.body.instalador, nome_projeto: { $exists: true }, $or: [{ 'dtinibusca': { $lte: datafim, $gte: dataini } }, { 'dtfimbusca': { $lte: datafim, $gte: dataini } }] }
    Pessoa.findOne({ _id: req.body.instalador }).lean().then((pessel) => {
        Pessoa.find({ user: id, funins: 'checked' }).lean().then((pessoa) => {
            Equipe.find(sql).then((equipe) => {
                equipe.forEach((e) => {
                    //console.log('e._id=>' + e._id)
                    //console.log('e._id=>' + e.insres)
                    Pessoa.findOne({ _id: e.insres }).then((tecnico) => {
                        q++
                        inicio = e.dtinicio
                        fim = e.dtfim
                        anoinicio = inicio.substring(0, 4)
                        anofim = fim.substring(0, 4)
                        mesinicio = inicio.substring(5, 7)
                        mesfim = fim.substring(5, 7)
                        diainicio = inicio.substring(8, 11)
                        diafim = fim.substring(8, 11)
                        con1 = String(mesinicio) + String(diainicio)
                        con2 = String(mesfim) + String(diafim)
                        dif1 = parseFloat(con2) - parseFloat(con1) + 1

                        if (meshoje == mesinicio) {
                            if (parseFloat(anotitulo) == parseFloat(anoinicio)) {
                                mes = meshoje
                                if (parseFloat(anofim) > parseFloat(anoinicio)) {
                                    //console.log('projeto ultrapassa anos')
                                    dia = diainicio
                                    if (meshoje == 1 || meshoje == 3 || meshoje == 5 || meshoje == 7 || meshoje == 8 || meshoje == 10 || meshoje == 12) {
                                        dif = 31
                                    } else {
                                        dif = 30
                                    }
                                } else {
                                    if (mesfim > mesinicio) {
                                        data1 = new Date(anofim + '-' + mesfim + '-' + '31')
                                        data2 = new Date(inicio)
                                        dif = Math.abs(data1.getTime() - data2.getTime())
                                        days = Math.ceil(dif / (1000 * 60 * 60 * 24))
                                        if (data1.getTime() < data2.getTime()) {
                                            days = days * -1
                                        }
                                        //console.log('days=>' + days)
                                        dia = diainicio
                                        dif = days + 1
                                    } else {
                                        dia = diainicio
                                        dif = parseFloat(diafim) - parseFloat(diainicio) + 1
                                        //console.log('dia=>' + dia)
                                        //console.log('dif=>' + dif)
                                    }
                                }
                            } else {
                                //console.log('anos diferente')
                                dia = 0
                                dif = 0
                            }
                        } else {
                            //console.log('diferente')
                            difmes = parseFloat(mesfim) - parseFloat(mesinicio) + 1
                            //console.log('difmes=>' + difmes)
                            if (difmes != 0) {
                                //console.log('difmes=>' + difmes)
                                if (difmes < 0) {
                                    difmes = difmes + 12
                                }
                                //console.log('mesinicio=>' + mesinicio)
                                for (i = 0; i < difmes; i++) {
                                    mes = parseFloat(mesinicio) + i
                                    if (mes > 12) {
                                        mes = mes - 12
                                    }
                                    //console.log('mes=>' + mes)
                                    //console.log('meshoje=>' + meshoje)
                                    if (mes == meshoje) {
                                        if (mes < 10) {
                                            mes = '0' + mes
                                            dia = '01'
                                        }
                                        break;
                                    }
                                }
                                if (anotitulo == anofim) {
                                    if (mes == mesfim) {
                                        dif = parseFloat(diafim)
                                    } else {
                                        if (meshoje == 1 || meshoje == 3 || meshoje == 5 || meshoje == 7 || meshoje == 8 || meshoje == 10 || meshoje == 12) {
                                            dif = 31
                                        } else {
                                            dif = 30
                                        }
                                    }
                                } else {
                                    dia = 0
                                    dif = 0
                                }
                            } else {
                                dif = 0
                                dia = 0
                            }
                        }

                        //console.log('dif=>' + dif)
                        //console.log('dia=>' + dia)
                        //console.log('mes=>' + mes)
                        y = Math.floor(Math.random() * 17)
                        if (y == x) {
                            y = Math.floor(Math.random() * 17)
                        } else {
                            if (y == z) {
                                y = Math.floor(Math.random() * 17)
                            }
                        }
                        x = y
                        z = y

                        color = cores[y]
                        //console.log('color=>' + color)
                        todasCores.push({ color })

                        for (i = 0; i < dif; i++) {
                            //console.log('dia=>' + dia)
                            //console.log('entrou laço')    
                            params_dia = { id: tecnico._id, tecnico: tecnico.nome, cor: color, instalador: 'true' }
                            if (meshoje == mes) {
                                switch (String(dia)) {
                                    case '01':
                                        dia01.push(params_dia)
                                        break;
                                    case '02':
                                        dia02.push(params_dia)
                                        break;
                                    case '03':
                                        dia03.push(params_dia)
                                        break;
                                    case '04':
                                        dia04.push(params_dia)
                                        break;
                                    case '05':
                                        dia05.push(params_dia)
                                        break;
                                    case '06':
                                        dia06.push(params_dia)
                                        break;
                                    case '07':
                                        dia07.push(params_dia)
                                        break;
                                    case '08':
                                        dia08.push(params_dia)
                                        break;
                                    case '09':
                                        dia09.push(params_dia)
                                        break;
                                    case '10':
                                        dia10.push(params_dia)
                                        break;
                                    case '11':
                                        dia11.push(params_dia)
                                        break;
                                    case '12':
                                        dia12.push(params_dia)
                                        break;
                                    case '13':
                                        dia13.push(params_dia)
                                        break;
                                    case '14':
                                        dia14.push(params_dia)
                                        break;
                                    case '15':
                                        dia15.push(params_dia)
                                        break;
                                    case '16':
                                        dia16.push(params_dia)
                                        break;
                                    case '17':
                                        dia17.push(params_dia)
                                        break;
                                    case '18':
                                        dia18.push(params_dia)
                                        break;
                                    case '19':
                                        dia19.push(params_dia)
                                        break;
                                    case '20':
                                        dia20.push(params_dia)
                                        break;
                                    case '21':
                                        dia21.push(params_dia)
                                        break;
                                    case '22':
                                        dia22.push(params_dia)
                                        break;
                                    case '23':
                                        dia23.push(params_dia)
                                        break;
                                    case '24':
                                        dia24.push(params_dia)
                                        break;
                                    case '25':
                                        dia25.push(params_dia)
                                        break;
                                    case '26':
                                        dia26.push(params_dia)
                                        break;
                                    case '27':
                                        dia27.push(params_dia)
                                        break;
                                    case '28':
                                        dia28.push(params_dia)
                                        break;
                                    case '29':
                                        dia29.push(params_dia)
                                        break;
                                    case '30':
                                        dia30.push(params_dia)
                                        break;
                                    case '31':
                                        dia31.push(params_dia)
                                        break;
                                }
                                dia++
                                if (dia < 10) {
                                    dia = '0' + dia
                                }
                                //console.log('dia=>' + dia)
                            }
                        }
                        //console.log('q=>' + q)
                        if (q == equipe.length) {
                            res.render('principal/agenda', {
                                dia01, dia02, dia03, dia04, dia05, dia06, dia07, dia08, dia09, dia10,
                                dia11, dia12, dia13, dia14, dia15, dia16, dia17, dia18, dia19, dia20, pessel,
                                dia21, dia22, dia23, dia24, dia25, dia26, dia27, dia28, dia29, dia30, dia31, pessoa,
                                mestitulo, meshoje, anotitulo, todasCores, dataini, datafim, ehinstalador: true,
                                janeiro, fevereiro, marco, abril, maio, junho, julho, agosto, setembro, outubro, novembro, dezembro
                            })
                        }
                    }).catch((err) => {
                        req.flash('error_msg', 'Falha ao encontra o instalador.')
                        res.redirect('/dashboard')
                    })
                })
            }).catch((err) => {
                req.flash('error_msg', 'Falha ao encontra a equipe.')
                res.redirect('/dashboard')
            })
        }).catch((err) => {
            req.flash('error_msg', 'Falha ao encontra a pessoa.')
            res.redirect('/dashboard')
        })
    }).catch((err) => {
        req.flash('error_msg', 'Falha ao encontra a pessoa.')
        res.redirect('/dashboard')
    })
})

router.post('/aplicaSelecao', ehAdmin, (req, res) => {
    let id
    const { _id } = req.user
    const { user } = req.user
    const { funges } = req.user
    const { vendedor } = req.user
    const { pessoa } = req.user

    let ehMaster

    if (naoVazio(user)) {
        id = user
        ehMaster = false
    } else {
        id = _id
        ehMaster = true
    }

    let enviado = []
    let negociando = []
    let baixado = []
    let ganho = []
    let totEnviado = 0;
    let totNegociando = 0;
    let totPerdido = 0;
    let totGanho = 0;
    var totAnalise = 0;
    var totComparando = 0;
    var totPreco = 0;

    let dataini
    let datafim
    let ano = req.body.ano
    let mes = req.body.mes
    let mestitulo = ''
    let diaini = '01'

    let cliente

    let janeiro
    let fevereiro
    let marco
    let abril
    let maio
    let junho
    let julho
    let agosto
    let setembro
    let outubro
    let novembro
    let dezembro
    let todos

    let match = {}

    switch (String(mes)) {
        case 'Janeiro':
            janeiro = 'active'
            mestitulo = 'Janeiro'
            mes = '01'
            diafim = '31'
            break;
        case 'Fevereiro':
            fevereiro = 'active'
            mestitulo = 'Fevereiro'
            mes = '02'
            diafim = '28'
            break;
        case 'Março':
            marco = 'active'
            mestitulo = 'Março'
            mes = '03'
            diafim = '31'
            break;
        case 'Abril':
            abril = 'active'
            mestitulo = 'Abril'
            mes = '04'
            diafim = '30'
            break;
        case 'Maio':
            maio = 'active'
            mestitulo = 'Maio'
            mes = '05'
            diafim = '31'
            break;
        case 'Junho':
            junho = 'active'
            mestitulo = 'Junho'
            mes = '06'
            diafim = '30'
            break;
        case 'Julho':
            julho = 'active'
            mestitulo = 'Julho'
            mes = '07'
            diafim = '31'
            break;
        case 'Agosto':
            agosto = 'active'
            mestitulo = 'Agosto'
            mes = '08'
            diafim = '31'
            break;
        case 'Setembro':
            setembro = 'active'
            mestitulo = 'Setembro'
            mes = '09'
            diafim = '30'
            break;
        case 'Outubro':
            outubro = 'active'
            mestitulo = 'Outubro'
            mes = '10'
            diafim = '31'
            break;
        case 'Novembro':
            novembro = 'active'
            mestitulo = 'Novembro'
            mes = '11'
            diafim = '30'
            break;
        case 'Dezembro':
            dezembro = 'active'
            mestitulo = 'Dezembro'
            mes = '12'
            diafim = '31'
            break;
        case 'Todos':
            todos = 'active'
            mestitulo = 'Todos'
            dataini = String(ano) + '01' + '01'
            datafim = String(ano) + '12' + '31'
            break;
    }

    if (String(mes) != 'Todos') {
        if (naoVazio(req.body.diafim)) {
            if (req.body.diafim < 10) {
                diafim = "0" + String(req.body.diafim)
            } else {
                diafim = String(req.body.diafim)
            }
        }
        if (naoVazio(req.body.diaini)) {
            if (req.body.diaini < 10) {
                diaini = "0" + String(req.body.diaini)
            } else {
                diaini = String(req.body.diaini)
            }
        }
        dataini = String(ano) + mes + diaini
        datafim = String(ano) + mes + diafim
    }


    if (naoVazio(vendedor)) {
        match = { user: id, vendedor: pessoa }
    } else {
        match = { user: id }
    }

    Projeto.aggregate([
        {
            $match: match
        },
        {
            $lookup: {
                from: 'clientes',
                let: { id_cliente: "$cliente" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: ["$_id", "$$id_cliente"]
                            }
                        }
                    },
                    {
                        $project: {
                            nome: 1
                        }
                    }],
                as: 'clientes'
            }
        },
        {
            $lookup: {
                from: 'pedidos',
                let: {
                    id_pedido: "$pedido"
                },
                pipeline: [{
                    $match: {
                        $expr: {
                            $eq: ["$_id", "$$id_pedido"]
                        }
                    }
                },
                {
                    $project: { data: 1 }
                }
                ],
                as: "pedidos"
            }
        },
        {
            $project: {
                seq: 1,
                status: 1,
                ganho: 1,
                baixada: 1,
                valor: 1,
                datacad: 1,
                clientes: 1,
                pedidos: 1
            }
        }
    ]).then(result => {
        result.map(item => {
            let dataCliente = item.clientes
            dataCliente.map(i => cliente = i.nome);
            //console.log(cliente);
            if (item.status == 'Enviado' && item.ganho == false && naoVazio(item.motivo) == false) {
                if (item.datacad < parseFloat(datafim) && item.datacad > parseFloat(dataini)) {
                    if (naoVazio(item.valor)) {
                        totEnviado = totEnviado + item.valor;
                    }
                    enviado.push({ id: item._id, cliente, seq: item.seq, status: item.status });
                }
            }

            let database = item.datacad;
            let dataPedido = item.pedidos;
            if (dataPedido.length > 0) {
                dataPedido.map(i => database = dataBusca(i.data));
                //console.log('item.datacad=>' + item.datacad)
                //console.log('item.pedidos.data=>' + item.pedidos.data)
            }
            if (item.ganho == true) {
                if (database < parseFloat(datafim) && database > parseFloat(dataini)) {
                    if (naoVazio(item.valor)) {
                        totGanho = totGanho + item.valor;
                    }
                    ganho.push({ id: item._id, cliente, seq: item.seq, status: item.status });
                }
            } else {
                if (item.datacad < parseFloat(datafim) && item.datacad > parseFloat(dataini)) {
                    if (item.baixada == true) {
                        if (naoVazio(item.valor)) {
                            totPerdido = totPerdido + item.valor
                        }
                        baixado.push({ id: item._id, cliente, seq: item.seq, status: item.status, motivo: item.motivo })
                    } else {
                        if (item.status == 'Negociando' || item.status == 'Analisando Financiamento' || item.status == 'Comparando Propostas' || item.status == 'Aguardando redução de preço') {
                            var totAnalise = 0
                            var totComparando = 0
                            var totPreco = 0
                            if (naoVazio(item.valor)) {
                                if (item.status == 'Comparando Propostas') {
                                    totComparando = totComparando + item.valor
                                }
                                if (item.status == 'Analisando Financiamento') {
                                    totAnalise = totAnalise + item.valor
                                }
                                if (item.status == 'Aguardando redução de preço') {
                                    totPreco = totPreco + item.valor
                                }
                                totNegociando = totNegociando + item.valor
                            }
                            negociando.push({ id: item._id, cliente, seq: item.seq, status: item.status })
                        }
                    }
                }
            }
        })

        totEnviado = mascaraDecimal(totEnviado)
        totGanho = mascaraDecimal(totGanho)
        totPerdido = mascaraDecimal(totPerdido)
        totNegociando = mascaraDecimal(totNegociando)

        enviado.sort(comparaNum)
        negociando.sort(comparaNum)
        ganho.sort(comparaNum)
        baixado.sort(comparaNum)

        //console.log('totComparando=>' + totComparando)
        if (naoVazio(totComparando)) {
            totComparando = mascaraDecimal(totComparando)
        }
        if (naoVazio(totAnalise)) {
            totAnalise = mascaraDecimal(totAnalise)
        }
        if (naoVazio(totPreco)) {
            totPreco = mascaraDecimal(totPreco)
        }
        let numdiaini = parseFloat(diaini);
        let numdiafim = parseFloat(diafim);
        res.render('principal/selecao', {
            enviado, negociando, ganho, baixado, mestitulo, ano, numdiaini, numdiafim,
            janeiro, fevereiro, marco, abril, maio, junho, julho, agosto, setembro, outubro, novembro, dezembro, todos,
            totEnviado, totGanho, totPerdido, totNegociando, totComparando, totAnalise, totPreco, funges, ehMaster
        })
    })
})

router.post('/selecao', ehAdmin, (req, res) => {
    var idneg = []
    var idbax = []
    var idgan = []
    idneg = req.body.idneg
    idbax = req.body.idbax
    idgan = req.body.idgan

    //console.log("idgan=>" + idgan)

    if (naoVazio(idneg)) {
        if (idneg.length > 0) {
            for (i = 0; i < idneg.length; i++) {
                seq = idneg[i].split(' - ')
                Projeto.findOne({ seq: seq[0] }).then((pn) => {
                    pn.status = 'Negociando'
                    pn.save()
                }).catch((err) => {
                    req.flash('error_msg', 'Falha ao encontrar a projeto')
                    res.redirect('/')
                })
            }
        }
    }

    if (naoVazio(idbax)) {
        if (idbax.length > 0) {
            for (i = 0; i < idbax.length; i++) {
                seq = idbax[i].split(' - ')
                Projeto.findOne({ seq: seq[0] }).then((pb) => {
                    pb.baixada = true
                    if (naoVazio(pb.motivo) == false) {
                        pb.motivo = 'Sem motivo'
                    }
                    pb.dtbaixa = dataHoje()
                    pb.save()
                }).catch((err) => {
                    req.flash('error_msg', 'Falha ao encontrar a projeto<selecao>.')
                    res.redirect('/')
                })
            }
        }
    }
    //console.log('idgan.length=>' + idgan.length)
    if (naoVazio(idgan)) {
        if (idgan.length > 0) {
            for (i = 0; i < idgan.length; i++) {
                //console.log('idgan[i]=>' + idgan[i])
                seq = idgan[i].split(' - ')
                //console.log('seq=>' + seq[0])
                Projeto.findOne({ seq: seq[0] }).then((pg) => {
                    pg.ganho = true
                    pg.save()
                }).catch((err) => {
                    req.flash('error_msg', 'Falha ao encontrar a projeto')
                    res.redirect('/')
                })
            }
        }
    }

    res.redirect('/gerenciamento/selecao')
})

router.post('/aplicarstatus/', ehAdmin, (req, res) => {
    const { vendedor } = req.user
    Projeto.findOne({ _id: req.body.id }).then((p) => {
        var texto
        if (req.body.tipo == 'status') {
            if (naoVazio(p.descstatus)) {
                texto = p.descstatus
            } else {
                texto = ''
            }
            if (naoVazio(req.body.obs)) {
                texto = texto + '\n' + '[' + dataMensagem(dataHoje()) + ']' + '-' + req.body.status + '\n' + req.body.obs
            }
            p.status = req.body.status
            p.descstatus = texto
            p.datastatus = dataHoje()
            p.save().then(() => {
                req.flash('success_msg', 'Status da negociacão alterado.')
                if (naoVazio(vendedor)) {
                    res.redirect('/dashboard')
                } else {
                    res.redirect('/gerenciamento/selecao')
                }
            }).catch((err) => {
                req.flash('error_msg', 'Houve um erro ao salvar a projeto.')
                res.redirect('/gerenciamento/selecao/')
            })
        } else {
            if (naoVazio(p.descmot)) {
                texto = p.descmot
            } else {
                texto = ''
            }
            if (naoVazio(req.body.obs)) {
                texto = texto + '\n' + '[' + dataMensagem(dataHoje()) + ']' + '-' + req.body.motivo + '\n' + req.body.obs
            }
            p.baixada = true
            p.status = 'Perdido'
            p.motivo = req.body.motivo
            p.dtbaixa = dataHoje()
            p.descmot = texto
            p.save().then(() => {
                req.flash('success_msg', 'Projeto baixado')
                if (naoVazio(vendedor)) {
                    res.redirect('/dashboard')
                } else {
                    res.redirect('/gerenciamento/selecao')
                }
            }).catch((err) => {
                req.flash('error_msg', 'Houve um erro ao salvar a projeto.')
                res.redirect('/gerenciamento/selecao/')
            })
        }
    })
})

router.post('/baixardia/', ehAdmin, (req, res) => {
    var mensagem = ''
    var dias = []
    var tamdias = 0
    var diaantes = 0
    var dia = 0
    var data2 = new Date(req.body.databaixa)
    Tarefas.findOne({ _id: req.body.id, $or: [{ dataini: req.body.databaixa }, { datafim: req.body.databaixa }, { 'buscadataini': { $lte: dataBusca(req.body.databaixa) } }, { 'buscadatafim': { $gte: dataBusca(req.body.databaixa) } }], $and: [{ 'buscadataini': { $lte: dataBusca(req.body.databaixa) } }, { 'buscadatafim': { $gte: dataBusca(req.body.databaixa) } }] }).then((t) => {
        if (naoVazio(t)) {

            var data1 = new Date(t.dataini)
            if (data2 > data1) {
                dif = Math.abs(data2.getTime() - data1.getTime())
                days = Math.ceil(dif / (1000 * 60 * 60 * 24))
                //console.log('days=>' + days)
                dia = days + 1
                //console.log('dia=>' + dia)
                Tarefas.findOneAndUpdate({ _id: req.body.id, 'dias.dia': dia }, { $set: { 'dias.$.feito': true } }).then(() => {
                    dias = t.dias
                    tamdias = dias.length
                    diaantes = dia - 2
                    diadepois = dia
                    mensagem = 'Dia baixado com sucesso.'
                    //console.log('tamdias=>' + tamdias)
                    //console.log('dia=>' + dia)
                    if ((tamdias == dia) && (dias[diaantes].feito == true)) {
                        t.concluido = true
                        t.databaixa = dataHoje()
                        t.save().then(() => {
                            mensagem = mensagem + ' Tarefa baixada com sucesso'
                            req.flash('success_msg', mensagem)
                            res.redirect('/gerenciamento/tarefa/' + req.body.id)
                        }).catch((err) => {
                            req.flash('error_msg', 'Houve um erro ao baixar o dia da tarefa.')
                            res.redirect('/gerenciamento/tarefa/' + req.body.id)
                        })
                    } else {

                        req.flash('success_msg', mensagem)
                        res.redirect('/gerenciamento/tarefa/' + req.body.id)


                    }
                    // diaantes = dias[days].feito
                    // diadepois = dias[dia].feito
                    //console.log('diaantes=>' + diaantes)
                    //console.log('diadepois=>' + diadepois)
                }).catch((err) => {
                    req.flash('error_msg', 'Houve um erro ao baixar o dia da tarefa.')
                    res.redirect('/gerenciamento/tarefa/' + req.body.id)
                })
            } else {
                //console.log('mesmo dia')
                Tarefas.findOneAndUpdate({ _id: req.body.id, 'dias.dia': 1 }, { $set: { 'dias.$.feito': true } }).then(() => {
                    //console.log('achou mesmo dia')
                    req.flash('success_msg', 'Dia baixado com sucesso.')
                    res.redirect('/gerenciamento/tarefa/' + req.body.id)
                }).catch((err) => {
                    req.flash('error_msg', 'Houve um erro ao baixar o dia da tarefa.')
                    res.redirect('/gerenciamento/tarefa/' + req.body.id)
                })
            }
        } else {
            req.flash('aviso_msg', 'Não é possível baixar uma data fora do cronograma da tarefa.')
            res.redirect('/gerenciamento/tarefa/' + req.body.id)
        }
    })
})

router.post('/exportar/', ehAdmin, (req, res) => {

    const { _id } = req.user
    const { user } = req.user
    var id

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }

    var busca = {}
    var sql = {}
    var lista = []
    var dados = []
    var valor = 0
    var total = 0
    var q = 0

    var stats = req.body.status
    var cliente = req.body.cliente
    var vendedor = req.body.vendedor
    var dtinicio = req.body.inicio
    var dtfim = req.body.fim
    var nome_vendedor
    var dtcadastro

    //console.log('stats=>' + req.body.status)
    //console.log('cliente=>' + req.body.cliente)
    //console.log('vendedor=>' + req.body.vendedor)
    //console.log('dtinicio=>' + req.body.inicio)
    //console.log('dtinicio=>' + req.body.fim)

    if (vendedor != 'Todos' && cliente != 'Todos' && stats != 'Todos') {
        sql = { user: id, cliente: cliente, vendedor: vendedor, status: stats }
    } else {
        if (vendedor != 'Todos' && cliente != 'Todos' && stats == 'Todos') {
            sql = { user: id, cliente: cliente, vendedor: vendedor, 'datacad': { $gte: dtinicio, $lte: dtfim } }
        } else {
            if (vendedor != 'Todos' && cliente == 'Todos' && stats == 'Todos') {
                sql = { user: id, vendedor: vendedor, 'datacad': { $gte: dtinicio, $lte: dtfim } }
            } else {
                if (vendedor == 'Todos' && cliente != 'Todos' && stats == 'Todos') {
                    sql = { user: id, cliente: cliente, 'datacad': { $gte: dtinicio, $lte: dtfim } }
                } else {
                    if (vendedor == 'Todos' && cliente == 'Todos' && stats != 'Todos') {
                        sql = { user: id, status: stats, 'datacad': { $gte: dtinicio, $lte: dtfim } }
                    } else {
                        if (vendedor != 'Todos' && cliente == 'Todos' && stats != 'Todos') {
                            sql = { user: id, vendedor: vendedor, 'datacad': { $gte: dtinicio, $lte: dtfim } }
                        } else {
                            if (vendedor == 'Todos' && cliente != 'Todos' && stats != 'Todos') {
                                sql = { user: id, cliente: cliente, 'datacad': { $gte: dtinicio, $lte: dtfim } }
                            } else {
                                sql = { user: id, 'datacad': { $gte: dtinicio, $lte: dtfim } }
                            }
                        }
                    }
                }
            }
        }
    }
    //console.log('sql=>' + JSON.stringify(sql))
    Cliente.find({ user: id }).lean().then((todos_clientes) => {
        Pessoa.find({ user: id, vendedor: 'checked' }).lean().then((todos_vendedores) => {
            Projeto.find(sql).sort({ 'data': -1 }).then((projeto) => {
                if (naoVazio(projeto)) {
                    projeto.forEach((e) => {
                        //console.log('cliente=>'+e.cliente)
                        Cliente.findOne({ _id: e.cliente }).then((cliente) => {
                            //console.log('cliente=>'+e.vendedor)
                            Pessoa.findOne({ _id: e.vendedor }).then((vendedor) => {
                                q++

                                if (naoVazio(e.datacad)) {
                                    dtcadastro = e.datacad
                                } else {
                                    dtcadastro = '00000000'
                                }

                                if (naoVazio(e.dtinicio)) {
                                    dtinicio = e.dtinicio
                                } else {
                                    dtinicio = '0000-00-00'
                                }

                                if (naoVazio(e.dtfim)) {
                                    dtfim = e.dtfim
                                } else {
                                    dtfim = '0000-00-00'
                                }

                                if (naoVazio(vendedor)) {
                                    nome_vendedor = vendedor.nome
                                } else {
                                    nome_vendedor = ''
                                }

                                //console.log('e.valor=>' + e.valor)
                                if (naoVazio(e.valor)) {
                                    valor = e.valor
                                    total = total + e.valor
                                } else {
                                    valor = 0
                                }

                                dados.push({ s: String(e.status), seq: String(e.seq), uf: String(e.uf), cidade: String(e.cidade), cliente: String(cliente.nome), nome_vendedor, valor: String(mascaraDecimal(valor)), cadastro: String(dataMsgNum(dtcadastro)), inicio: String(dataMensagem(dtinicio)), fim: String(dataMensagem(dtfim)) })
                                lista.push({ s: String(e.status), id: e._id, seq: String(e.seq), uf: String(e.uf), cidade: String(e.cidade), valor: String(mascaraDecimal(valor)), cliente: String(cliente.nome), nome_vendedor, cadastro: String(dataMsgNum(dtcadastro)), inicio: String(dataMensagem(dtinicio)), fim: String(dataMensagem(dtfim)) })
                                //console.log("q=>" + q)
                                //console.log("projeto.length=>" + projeto.length)
                                if (q == projeto.length) {
                                    //console.log('lista=>' + lista)
                                    const wb = new xl.Workbook()
                                    const ws = wb.addWorksheet('Relatório')
                                    const headingColumnNames = [
                                        "Status",
                                        "Proposta",
                                        "UF",
                                        "Cidade",
                                        "Cliente",
                                        "Vendedor",
                                        "Valor",
                                        "Cadastro",
                                        "Inicio Instalação",
                                        "Fim Instalação",
                                    ]
                                    var headingColumnIndex = 1; //diz que começará na primeira linha
                                    headingColumnNames.forEach(heading => { //passa por todos itens do array
                                        //cria uma célula do tipo string para cada título
                                        ws.cell(1, headingColumnIndex++).string(heading)
                                    })
                                    var rowIndex = 2 //começa na linha 2
                                    dados.forEach(record => { //passa por cada item do data
                                        var columnIndex = 1; //diz para começar na primeira coluna
                                        //console.log('transforma cada objeto em um array onde cada posição contém as chaves do objeto (name, email, cellphone)')
                                        Object.keys(record).forEach(columnName => {
                                            //cria uma coluna do tipo string para cada item
                                            ws.cell(rowIndex, columnIndex++).string(record[columnName])
                                        });
                                        rowIndex++; //incrementa o contador para ir para a próxima linha
                                    })
                                    rowIndex++
                                    ws.cell(rowIndex, 6).string('Total Valor R$:')
                                    ws.cell(rowIndex, 7).string(String(total))
                                    ws.cell(rowIndex, 2).string('Quantidade Total: ' + String(q))
                                    var time = new Date()
                                    var arquivo = 'relatorio_propostas_' + dataHoje() + time.getTime() + '.xlsx'
                                    //console.log('arquivi=>' + arquivo)
                                    // var sucesso = []
                                    // sucesso.push({texto: 'Relatório exportado com sucesso.'})
                                    wb.writeToBuffer().then(function (buffer) {
                                        //console.log('buffer excel')
                                        res
                                            .set('content-disposition', `attachment; filename="${arquivo}";  filename*=UTF-8''${encodeURI(arquivo)}`) // filename header
                                            .type('.xlsx') // setting content-type to xlsx. based on file extention
                                            .send(buffer)
                                        //.render('principal/consulta', { qtd: q, lista, todos_clientes, todos_vendedores, total: mascaraDecimal(total), stats, vendedor, cliente, inicio: dtinicio, fim: dtfim, mostrar: '', sucesso })
                                    })
                                    // var dir = __dirname
                                    // dir = dir.replace('routes','')
                                    // const file = `${dir}/upload/'`+arquivo;
                                    // res.download(file)
                                }
                            }).catch((err) => {
                                req.flash('error_msg', 'Nenhum vendedor encontrado.')
                                res.redirect('/relatorios/consulta')
                            })
                        }).catch((err) => {
                            req.flash('error_msg', 'Nenhum cliente encontrado.')
                            res.redirect('/relatorios/consulta')
                        })
                    })
                } else {
                    req.flash('error_msg', 'Nenhum projeto encontrado.')
                    res.redirect('/relatorios/consulta')
                }
            }).catch((err) => {
                req.flash('error_msg', 'Nenhum projeto encontrado.')
                res.redirect('/relatorios/consulta')
            })
        }).catch((err) => {
            req.flash('error_msg', 'Nenhum vendedor encontrado.')
            res.redirect('/relatorios/consulta')
        })
    }).catch((err) => {
        res.redirect('/relatorios/consulta')
    })
})

router.get('/payprj/:id', ehAdmin, (req, res) => {
    Projeto.findOne({ _id: req.params.id }).then((projeto) => {
        //console.log('projeto.autorizado=>' + projeto.autorizado)
        if (projeto.pago == true) {
            projeto.pago = false
        } else {
            projeto.pago = true
        }
        projeto.save().then(() => {
            req.flash('success_msg', 'Projeto pago.')
            res.redirect('/gerenciamento/projeto/' + req.params.id)
        })
    }).catch((err) => {
        req.flash('error_msg', 'Falha ao encontrar o projeto')
        res.redirect('/relatorios/consulta')
    })
})

router.get('/authprj/:id', ehAdmin, (req, res) => {
    Projeto.findOne({ _id: req.params.id }).then((projeto) => {
        //console.log('projeto.autorizado=>' + projeto.autorizado)
        if (projeto.autorizado == true) {
            projeto.autorizado = false
        } else {
            projeto.autorizado = true
        }
        projeto.save().then(() => {
            req.flash('success_msg', 'Projeto autorizado pelo projetista.')
            res.redirect('/gerenciamento/projeto/' + req.params.id)
        })
    }).catch((err) => {
        req.flash('error_msg', 'Falha ao encontrar o projeto')
        res.redirect('/relatorios/consulta')
    })
})

router.get('/pagoprj/:id', ehAdmin, (req, res) => {
    Projeto.findOne({ _id: req.params.id }).then((projeto) => {
        if (projeto.pago == true) {
            projeto.pago = false
        } else {
            projeto.pago = true
        }
        projeto.save().then(() => {
            req.flash('success_msg', 'Projeto pago pelo projetista')
            res.redirect('/gerenciamento/projeto/' + req.params.id)
        })
    }).catch((err) => {
        req.flash('error_msg', 'Falha ao encontrar o projeto')
        res.redirect('/relatorios/consulta')
    })
})

router.get('/exportarOrcamento/:id', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    var id

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }
    var workbook = new excel.Workbook()

    Empresa.findOne({ user: id }).then((empresa) => {
        Projeto.findOne({ _id: req.params.id }).then((projeto) => {
            Pessoa.findOne({ _id: projeto.vendedor }).then((vendedor) => {
                Cliente.findOne({ _id: projeto.cliente }).then((cliente) => {
                    var arquivo = 'orcamento_' + projeto.seq + '_' + cliente.nome + dataHoje() + '.xlsx'
                    workbook.xlsx.readFile('./upload/orcamento.xlsx')
                        .then(function () {
                            var row
                            var desc
                            var lista = []
                            var wslista = workbook.getWorksheet('Painel e Inversor')
                            for (i = 60; i < 76; i++) {
                                row = wslista.getRow(i)
                                desc = '"' + row.getCell(2).value + '"'
                                lista.push(desc.toString())
                            }
                            var wscalc = workbook.getWorksheet('Cálculo')
                            //console.log(lista)
                            wscalc.getCell('B17').dataValidation = {
                                type: 'list',
                                allowBlank: true,
                                formulae: [lista]
                            }
                            var wsdados = workbook.getWorksheet('DADOS')
                            row = wsdados.getRow(2)
                            //cabeçalho
                            row.getCell(2).value = vendedor.nome
                            //nome cliente
                            row.getCell(3).value = cliente.nome
                            //documento
                            //console.log('cpf=>'+cliente.cpf)
                            //console.log('cnpj=>'+cliente.cnpj)
                            if (cliente.cpf != '0') {
                                row.getCell(4).value = 'CPF'
                                row.getCell(5).value = cliente.cpf
                            } else {
                                row.getCell(4).value = 'CNPJ'
                                row.getCell(5).value = cliente.cnpj
                            }
                            //número proposta
                            row.getCell(6).value = projeto.seq
                            //endereço
                            row.getCell(7).value = projeto.endereco
                            //contato
                            row.getCell(8).value = cliente.celular
                            //cidade
                            row.getCell(9).value = projeto.cidade
                            //cidade
                            //console.log('projeto.datacad=>' + projeto.datacad)
                            row.getCell(10).value = dataMensagem(dataInput(String(projeto.datacad)))
                            //unidades consumidoras      
                            //janeiro          
                            var uc = projeto.uc
                            i = 4
                            uc.forEach((e) => {
                                //console.log('i=>' + i)
                                row = wsdados.getRow(16)
                                //console.log(' e.jan=>' + e.jan)
                                row.getCell(i).value = e.jan
                                //fevereiro          
                                row = wsdados.getRow(17)
                                row.getCell(i).value = e.fev
                                //março          
                                row = wsdados.getRow(18)
                                row.getCell(i).value = e.mar
                                //abril          
                                row = wsdados.getRow(19)
                                row.getCell(i).value = e.abr
                                //maio          
                                row = wsdados.getRow(20)
                                row.getCell(i).value = e.mai
                                //junho          
                                row = wsdados.getRow(21)
                                row.getCell(i).value = e.jun
                                //julho          
                                row = wsdados.getRow(22)
                                row.getCell(i).value = e.jul
                                //agosto          
                                row = wsdados.getRow(23)
                                row.getCell(i).value = e.ago
                                //setembro          
                                row = wsdados.getRow(24)
                                row.getCell(i).value = e.set
                                //outubro          
                                row = wsdados.getRow(25)
                                row.getCell(i).value = e.out
                                //novembro          
                                row = wsdados.getRow(26)
                                row.getCell(i).value = e.nov
                                //dezembro         
                                row = wsdados.getRow(27)
                                row.getCell(i).value = e.dez
                                i++
                            })
                            //configuracao perdas
                            var perda
                            //console.log('empresa.perdaoeste=>'+empresa.perdaoeste)
                            switch (projeto.orientacao) {
                                case 'Oeste':
                                    perda = empresa.perdaoeste
                                    break;
                                case 'Leste':
                                    perda = empresa.perdaleste
                                    break;
                                case 'Norte':
                                    perda = empresa.perdanorte
                                    break;
                                case 'Nordeste':
                                    perda = empresa.perdanordeste
                                    break;
                                case 'Noroeste':
                                    perda = empresa.perdanoroeste
                                    break;
                            }
                            row = wsdados.getRow(79)
                            row.getCell(3).value = perda
                            row = wsdados.getRow(80)
                            row.getCell(3).value = perda
                            row = wsdados.getRow(81)
                            row.getCell(3).value = perda
                            row = wsdados.getRow(82)
                            row.getCell(3).value = perda
                            row = wsdados.getRow(83)
                            row.getCell(3).value = perda
                            row = wsdados.getRow(84)
                            row.getCell(3).value = perda
                            row = wsdados.getRow(85)
                            row.getCell(3).value = perda
                            row = wsdados.getRow(86)
                            row.getCell(3).value = perda
                            row = wsdados.getRow(87)
                            row.getCell(3).value = perda
                            row = wsdados.getRow(88)
                            row.getCell(3).value = perda
                            row = wsdados.getRow(89)
                            row.getCell(3).value = perda
                            row = wsdados.getRow(90)
                            row.getCell(3).value = perda
                            row.commit()

                            res.setHeader(
                                "Content-Type",
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            )
                            res.setHeader(
                                "Content-Disposition",
                                "attachment; filename=" + arquivo
                            )
                            workbook.xlsx.write(res).then(function () {
                                res.end()
                            })
                        })
                }).catch((err) => {
                    req.flash('error_msg', 'Falha ao encontrar o cliente')
                    res.redirect('/relatorios/consulta')
                })
            }).catch((err) => {
                req.flash('error_msg', 'Falha ao encontrar o vendedor')
                res.redirect('/relatorios/consulta')
            })
        }).catch((err) => {
            req.flash('error_msg', 'Falha ao encontrar o projeto')
            res.redirect('/relatorios/consulta')
        })
    }).catch((err) => {
        req.flash('error_msg', 'Falha ao encontrar a empresa')
        res.redirect('/relatorios/consulta')
    })
})

router.post('/emandamento/', ehAdmin, async (req, res) => {

    const { _id } = req.user
    const { user } = req.user
    var id

    if (naoVazio(user)) {
        id = user
    } else {
        id = _id
    }

    let seq;
    let cliente;
    let nome_cliente;
    let parado;
    let autorizado;
    let pagamento;
    let instalado;
    let execucao;
    let instalador;
    let cidade;
    let uf;
    let telhado;
    let estrutura;
    let inversor;
    let modulos;
    let potencia;
    let sistema;
    let deadline;
    let ins_banco;
    let checkReal;
    let nome_ins;
    let id_ins;
    let nome_ins_banco;
    let id_ins_banco;
    var observacao;
    var obsprojetista;

    var listaAndamento = [];
    var addInstalador = [];

    const dataini = req.body.dataini;
    const datafim = req.body.datafim;
    const dtini = parseFloat(dataBusca(dataini));
    const dtfim = parseFloat(dataBusca(datafim));

    let filter_installer = req.body.instalador;
    let installer_name;
    let filter_status = req.body.status;
    let liberar_status = { $exists: true };
    let prjfeito_status = { $exists: true };
    let parado_status = { $exists: true };
    let sql_installer = {};

    let match = {};

    if (filter_status != 'Todos') {
        switch (filter_status) {
            case 'Aguardando': liberar_status = false; parado_status = false; prjfeito_status = false
                break;
            case 'Execução': liberar_status = true; parado_status = false; prjfeito_status = false
                break;
            case 'Instalado': liberar_status = true; parado_status = false; prjfeito_status = true
                break;
            case 'Parado': liberar_status = true; parado_status = true; prjfeito_status = false
                break;
        }
    }


    if (filter_installer != 'Todos') {
        const id_ins = await Pessoa.findById(filter_installer)
        match = {
            user: id,
            tarefa: { $exists: false },
            nome_projeto: { $exists: true },
            liberar: liberar_status,
            prjfeito: prjfeito_status,
            parado: parado_status,
            insres: id_ins._id,
            "dtfimbusca": {
                $gte: dtini,
                $lte: dtfim
            },
        }
    } else {
        match = {
            user: id,
            tarefa: { $exists: false },
            nome_projeto: { $exists: true },
            liberar: liberar_status,
            prjfeito: prjfeito_status,
            parado: parado_status,
            "dtfimbusca": {
                $gte: dtini,
                $lte: dtfim
            },
        }
    }

    //console.log('instalador=>' + typeof (req.body.instalador))
    //console.log('id=>'+typeof(id_ins._id))
    Cliente.find({ user: id }).lean().then((todos_clientes) => {
        Pessoa.find({ user: id, funins: 'checked' }).lean().then((todos_instaladores) => {

            Equipe.aggregate([
                {
                    $match: match
                },
                {
                    $lookup: {
                        from: 'projetos',
                        localField: '_id',
                        foreignField: 'equipe',
                        as: 'projeto'
                    }
                },
                {
                    $lookup: {
                        from: 'pessoas',
                        localField: 'insres',
                        foreignField: '_id',
                        as: 'instalador',
                    }
                }
            ]).then(async list => {

                for (const item of list) {
                    observacao = item.observacao;
                    deadline = await item.dtfim;
                    if (naoVazio(deadline) == false) {
                        deadline = '0000-00-00';
                    }
                    qtdmod = await item.qtdmod;


                    let projetos = await item.projeto;
                    let instaladores = await item.instalador;

                    if (projetos.length > 0) {

                        projetos.map(async register => {
                            id = register._id
                            seq = register.seq
                            cidade = register.cidade
                            uf = register.uf
                            telhado = register.telhado
                            estrutura = register.estrutura
                            inversor = register.plaKwpInv
                            modulos = register.plaQtdMod
                            potencia = register.plaWattMod
                            instalado = register.instalado
                            execucao = register.execucao
                            parado = register.parado
                            autorizado = register.autorizado
                            pagamento = register.pago
                            cliente = register.cliente
                            ins_banco = register.ins_banco
                            checkReal = register.ins_real
                            pedido = register.pedido
                            obsprojetista = register.obsprojetista

                            if (checkReal != true) {
                                checkReal = 'unchecked';
                            } else {
                                checkReal = 'checked';
                            }

                            if (naoVazio(modulos) && naoVazio(potencia)) {
                                sistema = ((modulos * potencia) / 1000).toFixed(2);
                            } else {
                                sistema = 0;
                            }

                        })

                        if (naoVazio(pedido)) {

                            instaladores.map(async register => {
                                instalador = register.nome;

                                nome_ins = instalador;
                                id_ins = register._id;

                                if (naoVazio(ins_banco)) {
                                    if (register._id == ins_banco) {
                                        addInstalador = [{ instalador, qtdmod }];
                                    } else {
                                        let nome_instalador = await Pessoa.findById(ins_banco);
                                        addInstalador = [{ instalador: nome_instalador.nome, qtdmod }];
                                    }
                                } else {
                                    addInstalador = [{ instalador, qtdmod }];
                                }
                            })

                            if (naoVazio(ins_banco)) {
                                await Pessoa.findById(ins_banco).then(this_ins_banco => {
                                    nome_ins_banco = this_ins_banco.nome;
                                    id_ins_banco = this_ins_banco._id;
                                })
                            } else {
                                nome_ins_banco = '';
                                id_ins_banco = '';
                            }

                            await Cliente.findById(cliente).then(this_cliente => {
                                nome_cliente = this_cliente.nome;
                            })

                            listaAndamento.push({
                                id, seq, parado, execucao, autorizado, pagamento, observacao, obsprojetista,
                                instalado, cliente: nome_cliente, cidade, uf, telhado, estrutura,
                                sistema, modulos, potencia, inversor, deadline, addInstalador,
                                dtfim: dataMensagem(deadline), nome_ins_banco, id_ins_banco, nome_ins, id_ins, checkReal
                            })

                            addInstalador = [];
                        }
                    }
                }

                listaAndamento.sort(comparaNum);
                res.render('principal/emandamento', {
                    listaAndamento, todos_clientes,
                    todos_instaladores, datafim, dataini
                })
            })

        }).catch((err) => {
            req.flash('error_msg', 'Nenhum instalador encontrado.')
            res.redirect('/dashboard')
        })
    }).catch((err) => {
        req.flash('error_msg', 'Nenhum cliente encontrado.')
        res.redirect('/dashboard')
    })
})

router.post('/salvarFotos', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    var id

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }
    var img = []
    var imgblob = []
    var foto = []
    var listaBuffer = []
    var ib
    var params
    var q = 0
    var mensagem
    var texto
    var notimg = true
    var imagem

    //console.log('salvar fotos')

    img = req.body.imagem
    imgblob = req.body.imgblob
    //console.log('img.length=>' + img.length)
    if (img.length < 100) {
        (async () => {
            await img.forEach((i) => {

                ib = imgblob[q].replace('blob:https://quasat.vimmus.com.br/', '')
                //ib = imgblob[q].replace('blob:http://localhost:3001/', '')
                ib = ib + '.png'

                data = i.replace(/^data:image\/\w+;base64,/, "")
                buf = Buffer.from(data, "base64")

                // (async () => {
                //     imagem = await resizeImg(buf, {
                //         width: 540,
                //         height: 960,
                //     })
                // })

                listaBuffer.push({ buffer: buf })
                foto.push({ "desc": ib, 'data': dataMensagem(dataHoje()) })
                q++
            })
        })()
        for (i = 0; i < q; i++) {

            ib = imgblob[i].replace('blob:https://quasat.vimmus.com.br/', '')
            //ib = imgblob[i].replace('blob:http://localhost:3001/', '')
            ib = ib + '.png'

            params = {
                Bucket: 'quasatimg',
                Key: ib,
                Body: listaBuffer[i].buffer
            }
            s3.upload(params, function (err, data) {
                if (err) {
                    throw err
                } else {
                    //console.log('Upload realizado com sucesso.')
                }
            })
        }

    } else {
        //console.log('lendo diretório')
        (async () => {

            ib = imgblob.replace('blob:https://quasat.vimmus.com.br/', '')
            //ib = imgblob.replace('blob:http://localhost:3001/', '')
            ib = ib + '.png'
            //console.log('ib=>' + ib)
            // strip off the data: url prefix to get just the base64-encoded bytes
            data = img.replace(/^data:image\/\w+;base64,/, "")
            buf = Buffer.from(data, "base64")
            imagem = await resizeImg(buf, {
                width: 540,
                height: 960,
            })

            foto.push({ "desc": ib, 'data': dataMensagem(dataHoje()) })

            //console.log('ib=>' + ib)

            params = {
                Bucket: 'quasatimg',
                Key: ib,
                Body: imagem
            }

            s3.upload(params, function (err, data) {
                if (err) {
                    throw err
                }
                //console.log(`File uploaded successfully. ${data.Location}`)
            })
        })()
    }

    var sql = []

    //console.log('req.body.tipo=>' + req.body.tipo)

    if (req.body.tipo == 'documento') {
        sql = { documento: foto }
    }
    if (req.body.tipo == 'local') {
        sql = { local: foto }
    }
    if (req.body.tipo == 'entrada') {
        sql = { entrada: foto }
    }
    if (req.body.tipo == 'disjuntor') {
        sql = { disjuntor: foto }
    }
    if (req.body.tipo == 'trafo') {
        sql = { trafo: foto }
    }
    if (req.body.tipo == 'localizacao') {
        sql = { localizacao: foto }
    }
    if (req.body.tipo == 'telhado') {
        sql = { telhado_foto: foto }
    }
    if (req.body.tipo == 'medidor') {
        sql = { medidor: foto }
    }
    if (req.body.tipo == 'fatura') {
        sql = { fatura: foto }
    }
    if (req.body.tipo == 'tarefa') {
        Projeto.findOne({ _id: req.body.idprj }).then((prj) => {
            //console.log('prj.cliente=>'+prj.cliente)
            Cliente.findOne({ _id: prj.cliente }).then((cliente) => {
                //console.log("cliente.nome=>"+cliente.nome)
                //console.log("req.body.id=>"+req.body.id)
                Tarefas.findOneAndUpdate({ _id: req.body.id }, { $push: { fotos: foto } }).then((e) => {
                    Tarefas.findOneAndUpdate({ _id: req.body.id }, { $set: { datafim: dataHoje() } }).then((e) => {
                        req.flash('success_msg', 'Foto(s) da instalação salva(s) com sucesso.')
                        //console.log('req.body.idprj=>' + req.body.idprj)
                        Tarefas.find({ projeto: req.body.idprj }).then((lista_tarefas) => {
                            //console.log('lista_tarefas=>'+lista_tarefas)
                            lista_tarefas.forEach((e) => {
                                //console.log('e.fotos=>' + e.fotos)
                                if (naoVazio(e.fotos) == false) {
                                    notimg = false
                                }
                            })
                            //console.log('notimg=>' + notimg)
                            if (notimg == true) {
                                Acesso.find({ user: id, notimg: 'checked' }).then((acesso) => {
                                    //console.log('acesso=>' + acesso)
                                    if (naoVazio(acesso)) {
                                        acesso.forEach((e) => {
                                            Pessoa.findOne({ _id: e.pessoa }).then((pessoa) => {
                                                //console.log('pessoa=>' + pessoa)
                                                //console.log('enviou mensagem')
                                                texto = 'Olá ' + pessoa.nome + ',' + '\n' +
                                                    'Todas as fotos da obra do projeto ' + prj.seq + ' para o cliente ' + cliente.nome + '  estão na plataforma. ' +
                                                    'Acesse https://vimmus.com.br/gerenciamento/orcamento/' + prj._id + ' para verificar.'
                                                //console.log('pessoa.celular=>'+pessoa.celular)
                                                client.messages
                                                    .create({
                                                        body: texto,
                                                        from: 'whatsapp:+554991832978',
                                                        to: 'whatsapp:+55' + pessoa.celular
                                                    })
                                                    .then((message) => {
                                                        q++
                                                        //console.log('q=>' + q)
                                                        //console.log('acesso.length=>' + acesso.length)
                                                        if (q == acesso.length) {
                                                            //console.log(message.sid)
                                                            res.redirect('/gerenciamento/mostrarFotos/tarefa@' + req.body.id + '@' + req.body.idprj)
                                                        }
                                                    }).done()

                                            }).catch((err) => {
                                                req.flash('error_msg', 'Houve um erro ao encontrar a pessoa<whats>.')
                                                res.redirect('/dashboard')
                                            })
                                        })
                                    } else {
                                        res.redirect('/gerenciamento/mostrarFotos/' + req.body.id + '@' + req.body.idprj)
                                    }
                                }).catch((err) => {
                                    req.flash('error_msg', 'Houve erro ao encontrar o acesso.')
                                    res.redirect('/gerenciamento/fotos/' + req.body.id)
                                })
                            } else {
                                //console.log('mostrar')
                                res.redirect('/gerenciamento/mostrarFotos/tarefa@' + req.body.id + '@' + req.body.idprj)
                            }
                        }).catch((err) => {
                            req.flash('error_msg', 'Houve erro ao encontrar a tarefa.')
                            res.redirect('/dashboard')
                        })
                    }).catch((err) => {
                        req.flash('error_msg', 'Houve erro ao salvar as tarefas.')
                        res.redirect('/dashboard')
                    })
                }).catch((err) => {
                    req.flash('error_msg', 'Houve erro ao salvar as tarefas.')
                    res.redirect('/dashboard')
                })
            }).catch((err) => {
                req.flash('error_msg', 'Houve erro ao encontrar o cliente.')
                res.redirect('/dashboard')
            })
        }).catch((err) => {
            req.flash('error_msg', 'Houve erro ao encontrar o projeto.')
            res.redirect('/dashboard')
        })
    } else {
        //console.log('sql=>' + sql)
        Projeto.findOneAndUpdate({ _id: req.body.id }, { $push: sql }).then(() => {
            Projeto.findOne({ _id: req.body.id }).then((prj) => {
                var disjuntor
                var medidor
                var trafo
                if (req.body.tipo == 'disjuntor') {
                    //console.log('entrou disjuntor')
                    disjuntor = foto
                    medidor = prj.medidor
                    trafo = prj.trafo
                }
                if (req.body.tipo == 'medidor') {
                    medidor = foto
                    disjuntor = prj.disjuntor
                    trafo = prj.trafo
                }
                if (req.body.tipo == 'trafo') {
                    trafo = foto
                    disjuntor = prj.disjuntor
                    medidor = prj.medidor
                }

                //console.log('disjuntor=>' + disjuntor)
                //console.log('medidor=>' + medidor)
                //console.log('trafo=>' + trafo)

                if ((req.body.tipo == 'disjutor' || req.body.tipo == 'medidor' || req.body.tipo == 'trafo') &&
                    (naoVazio(disjuntor) && naoVazio(medidor) && naoVazio(trafo))) {
                    q = 0
                    //console.log('levantamento de rede')
                    Acesso.find({ user: id, notdoc: 'checked' }).then((acesso) => {
                        if (naoVazio(acesso)) {
                            acesso.forEach((e) => {
                                Pessoa.findOne({ _id: e.pessoa }).then((projetista) => {
                                    //console.log(pessoa.celular)
                                    mensagem = 'Olá ' + projetista.nome + ',' + '\n' +
                                        'O levantamento de rede da proposta ' + prj.seq + ' foi realizado.' + '\n' +
                                        'Acesse: https://quasat.vimmus.com.br/orcamento/' + prj._id + ' para mais informações.'
                                    client.messages
                                        .create({
                                            body: mensagem,
                                            from: 'whatsapp:+554991832978',
                                            to: 'whatsapp:+55' + projetista.celular
                                        })
                                        .then((message) => {
                                            //console.log(message.sid)
                                            q++
                                            if (q == acesso.length) {
                                                req.flash('success_msg', 'Levantamento de rede realizado com sucesso.')
                                                res.redirect('/gerenciamento/orcamento/' + req.body.id)
                                            }
                                        }).done()
                                })
                            })
                        } else {
                            //console.log('aguardando')
                            req.flash('success_msg', 'Foto(s) adicionada(s) com sucesso.')
                            res.redirect('/gerenciamento/fotos/' + req.body.id)
                        }
                    }).catch((err) => {
                        req.flash('error_msg', 'Houve erro ao salvar o acesso.')
                        res.redirect('/dashboard')
                    })
                } else {
                    //console.log('aguardando')
                    if (req.body.caminho = 'fatura') {
                        req.flash('success_msg', 'Fatura(s) adicionada(s) com sucesso.')
                        res.redirect('/gerenciamento/fatura/' + req.body.id)
                    } else {
                        req.flash('success_msg', 'Foto(s) adicionada(s) com sucesso.')
                        res.redirect('/gerenciamento/fotos/' + req.body.id)
                    }
                }
            }).catch((err) => {
                req.flash('error_msg', 'Houve erro ao salvar o projeto.')
                res.redirect('/dashboard')
            })
        }).catch((err) => {
            req.flash('error_msg', 'Houve erro ao salvar a fatura.')
            res.redirect('/dashboard')
        })
    }
})

router.post('/observacao', ehAdmin, (req, res) => {
    var texto = ''
    var texto_salvo = ''
    var ids = req.body.seq
    var mensagem = ''
    const { _id } = req.user
    const { user } = req.user
    const { vendedor } = req.user
    const { orcamentista } = req.user
    const { funges } = req.user
    var id

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }

    // ids = ids.split('$@$')
    //console.log('id proposta=>' + ids[0])
    texto = '[' + dataMensagem(dataHoje()) + ']' + '\n' + req.body.obs
    //console.log('texto=>' + texto)
    //console.log('id projeto=>' + req.body.id)
    Projeto.findOne({ _id: req.body.id }).then((prj) => {
        Cliente.findOne({ _id: prj.cliente }).then((cliente) => {
            Pessoa.findOne({ _id: prj.vendedor }).then((pes_ven) => {
                Pessoa.findOne({ _id: prj.responsavel }).then((pes_res) => {
                    // var prj_proposta = prj.proposta
                    // prj_proposta.forEach((p) => {
                    //     //console.log('p._id=>' + p._id)
                    //     //console.log('ids[0]=>' + ids[0])
                    //     if (p._id == ids[0]) {
                    //         //console.log('igual')
                    //         if (naoVazio(p.obs)) {
                    //             texto_salvo = p.obs + '\n'
                    //             //console.log('texto_salvo=>' + texto_salvo)
                    //         }
                    //     }
                    if (naoVazio(prj.obs)) {
                        texto_salvo = prj.obs + '\n' + texto
                    } else {
                        texto_salvo = texto
                    }
                    //console.log('vendedor=>' + vendedor)
                    if (vendedor == true) {
                        Acesso.findOne({ pessoa: prj.responsavel, notobs: 'checked' }).then((acesso_responsavel) => {
                            if (naoVazio(acesso_responsavel)) {
                                mensagem = 'Olá ' + pes_res.nome + ',' + '\n' +
                                    'Foi adicionada uma observação à proposta: ' + prj.seq + ' do cliente: ' + cliente.nome + '\n' +
                                    'Mensagem: ' + req.body.obs + '\n' +
                                    'Acesse: https://quasat.vimmus.com.br/orcamento/' + prj._id + ' para mais informações.'

                                //console.log('mensagem=>' + mensagem)
                                //console.log('pes_res.celular=>' + pes_res.celular)

                                client.messages
                                    .create({
                                        body: mensagem,
                                        from: 'whatsapp:+554991832978',
                                        to: 'whatsapp:+55' + pes_res.celular
                                    })
                                    .then((message) => {
                                        //console.log(message.sid)
                                        //'proposta._id': ids[0] 
                                        //console.log('texto_salvo=>' + texto_salvo)
                                        Projeto.findOneAndUpdate({ _id: req.body.id }, { $set: { obs: texto_salvo } }).then(() => {
                                            req.flash('success_msg', 'Observação adicionada com sucesso')
                                            res.redirect('/gerenciamento/orcamento/' + req.body.id)
                                        }).catch((err) => {
                                            req.flash('error_msg', 'Houve um erro ao salvar a observação.')
                                            res.redirect('/gerenciamento/orcamento/' + req.body.id)
                                        })
                                    }).done()
                            } else {
                                Projeto.findOneAndUpdate({ _id: req.body.id }, { $set: { obs: texto_salvo } }).then(() => {
                                    req.flash('success_msg', 'Observação adicionada com sucesso')
                                    res.redirect('/gerenciamento/orcamento/' + req.body.id)
                                }).catch((err) => {
                                    req.flash('error_msg', 'Houve um erro ao salvar a observação.')
                                    res.redirect('/gerenciamento/orcamento/' + req.body.id)
                                })
                            }
                        }).catch((err) => {
                            req.flash('error_msg', 'Houve um erro ao encontrar o acesso.')
                            res.redirect('/gerenciamento/orcamento/' + req.body.id)
                        })
                    } else {
                        Acesso.findOne({ pessoa: prj.vendedor, notobs: 'checked' }).then((acesso_vendedor) => {
                            //console.log('acesso_vendedor=>' + acesso_vendedor)
                            if (naoVazio(acesso_vendedor)) {

                                mensagem = 'Olá ' + pes_ven.nome + ',' + '\n' +
                                    'Foi adicionada uma observação à proposta: ' + prj.seq + ' do cliente: ' + cliente.nome + '\n' +
                                    'Mensagem: ' + req.body.obs + '\n' +
                                    'Acesse: https://quasat.vimmus.com.br/orcamento/' + prj._id + ' para mais informações.'

                                //console.log('mensagem=>' + mensagem)
                                //console.log('pes_ven.celular=>' + pes_ven.celular)

                                client.messages
                                    .create({
                                        body: mensagem,
                                        from: 'whatsapp:+554991832978',
                                        to: 'whatsapp:+55' + pes_ven.celular
                                    })
                                    .then((message) => {
                                        //console.log(message.sid)
                                        Projeto.findOneAndUpdate({ _id: req.body.id, }, { $set: { 'obs': texto_salvo } }).then(() => {
                                            req.flash('success_msg', 'Observação adicionada com sucesso')
                                            res.redirect('/gerenciamento/orcamento/' + req.body.id)
                                        }).catch((err) => {
                                            req.flash('error_msg', 'Houve um erro ao salvar a observação.')
                                            res.redirect('/gerenciamento/orcamento/' + req.body.id)
                                        })

                                    }).done()

                            } else {
                                Projeto.findOneAndUpdate({ _id: req.body.id, }, { $set: { 'obs': texto_salvo } }).then(() => {
                                    req.flash('success_msg', 'Observação adicionada com sucesso')
                                    res.redirect('/gerenciamento/orcamento/' + req.body.id)
                                }).catch((err) => {
                                    req.flash('error_msg', 'Houve um erro ao salvar a observação.')
                                    res.redirect('/gerenciamento/orcamento/' + req.body.id)
                                })
                            }
                        }).catch((err) => {
                            req.flash('error_msg', 'Houve um erro ao encontrar o acesso.')
                            res.redirect('/gerenciamento/orcamento/' + req.body.id)
                        })
                    }
                }).catch((err) => {
                    req.flash('error_msg', 'Houve um erro ao encontrar a pessoa.')
                    res.redirect('/gerenciamento/orcamento/' + req.body.id)
                })
            }).catch((err) => {
                req.flash('error_msg', 'Houve um erro ao encontrar o cliente.')
                res.redirect('/gerenciamento/orcamento/' + req.body.id)
            })
        }).catch((err) => {
            req.flash('error_msg', 'Houve um erro ao encontrar o projeto.')
            res.redirect('/gerenciamento/orcamento/' + req.body.id)
        })
    })
})

router.post('/pedido', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    var id

    var potencia
    var vlrKit
    var vlrTotal = 0
    var vlrServico = 0

    var texto = ''
    var q = 0

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }

    //console.log('req.body.dataprazo=>' + req.body.dataprazo)
    //console.log('vlrServico=>' + req.body.vlrServico)
    //console.log('vlrKit=>' + req.body.vlrKit)
    //console.log('req.body.idpedido=>' + req.body.idpedido)
    Empresa.findOne({ user: id }).then((empresa) => {
        Projeto.findOne({ _id: req.body.id }).then((projeto) => {
            Cliente.findOne({ _id: projeto.cliente }).then((cliente) => {
                //console.log('req.body.idpedido=>' + req.body.idpedido)
                if (naoVazio(req.body.pagamento)) {
                    if (naoVazio(req.body.idpedido)) {
                        Pedido.findOne({ _id: req.body.idpedido }).then((pedido) => {
                            potencia = Math.trunc(parseFloat(req.body.plaQtdMod) * parseFloat(req.body.plaWattMod), 1) / 1000
                            //vlrServico = parseFloat(req.body.plaQtdMod) * parseFloat(empresa.vlrmdo)
                            //vlrTotal = parseFloat(vlrServico) + parseFloat(req.body.vlrKit)
                            pedido.vlrServico = parseFloat(req.body.vlrServico)
                            pedido.vlrKit = parseFloat(req.body.vlrKit)
                            pedido.vlrTotal = parseFloat(req.body.vlrTotal)
                            pedido.pagamento = req.body.pagamento
                            pedido.plaQtdMod = req.body.plaQtdMod
                            pedido.plaWattMod = req.body.plaWattMod
                            pedido.plaQtdInv = req.body.plaQtdInv
                            pedido.plaKwpInv = req.body.plaKwpInv
                            pedido.telhado = req.body.telhado
                            pedido.orientacao = req.body.orientacao
                            pedido.pagador = req.body.pagador
                            pedido.potencia = potencia
                            pedido.descuc = req.body.descuc
                            pedido.descug = req.body.descug
                            if (naoVazio(req.body.obs)) {
                                pedido.obs = req.body.obs
                            }
                            pedido.prazo = parseFloat(req.body.dataprazo)
                            pedido.save().then(() => {
                                //console.log('salvou pedido')
                                projeto.vlrServico = parseFloat(req.body.vlrServico)
                                projeto.vlrKit = parseFloat(req.body.vlrKit)
                                projeto.valor = parseFloat(req.body.vlrTotal)
                                projeto.telhado = req.body.telhado
                                projeto.potencia = potencia
                                projeto.orientacao = req.body.orientacao
                                projeto.plaQtdMod = req.body.plaQtdMod
                                projeto.plaWattMod = req.body.plaWattMod
                                projeto.plaQtdInv = req.body.plaQtdInv
                                projeto.plaKwpInv = req.body.plaKwpInv
                                projeto.descuc = req.body.descuc
                                projeto.descug = req.body.descug
                                projeto.save().then(() => {
                                    req.flash('success_msg', 'Pedido salvo com sucesso.')
                                    res.redirect('/gerenciamento/orcamento/' + req.body.id)
                                })
                            })
                        }).catch((err) => {
                            req.flash('error_msg', 'Houve erro ao encontrar o pedido.')
                            res.redirect('/gerenciamento/orcamento/' + req.body.id)
                        })
                    } else {
                        potencia = Math.trunc(parseFloat(req.body.plaQtdMod) * parseFloat(req.body.plaWattMod), 1) / 1000

                        const pedido = {
                            user: id,
                            projeto: req.body.id,
                            vlrServico: parseFloat(req.body.vlrServico),
                            vlrKit: parseFloat(req.body.vlrKit),
                            vlrTotal: parseFloat(req.body.vlrTotal),
                            pagamento: req.body.pagamento,
                            plaQtdMod: req.body.plaQtdMod,
                            plaWattMod: req.body.plaWattMod,
                            plaQtdInv: req.body.plaQtdInv,
                            plaKwpInv: req.body.plaKwpInv,
                            telhado: req.body.telhado,
                            orientacao: req.body.orientacao,
                            descuc: req.body.descuc,
                            descug: req.body.descug,
                            pagador: req.body.pagador,
                            obs: req.body.obs,
                            prazo: req.body.dataprazo,
                            potencia: potencia,
                            data: dataHoje()
                        }
                        new Pedido(pedido).save().then(() => {
                            Pedido.findOne({ user: id }).sort({ field: 'asc', _id: -1 }).then((novo_pedido) => {
                                var datafim = req.body.dataprazo
                                datafim = setData(dataHoje(), datafim)
                                //console.log('datafim=>' + datafim)
                                projeto.pedido = novo_pedido._id
                                projeto.vlrServico = parseFloat(req.body.vlrServico)
                                projeto.vlrKit = parseFloat(req.body.vlrKit)
                                projeto.valor = parseFloat(req.body.vlrTotal)
                                projeto.telhado = req.body.telhado
                                projeto.orientacao = req.body.orientacao
                                projeto.plaQtdMod = req.body.plaQtdMod
                                projeto.plaWattMod = req.body.plaWattMod
                                projeto.plaQtdInv = req.body.plaQtdInv
                                projeto.plaKwpInv = req.body.plaKwpInv
                                // projeto.plaQtdMod = req.body.plaQtdMod
                                // projeto.plaWattMod = req.body.plaWattMod
                                // projeto.plaQtdInv = req.body.plaQtdMod
                                // projeto.plaKwpInv = req.body.plaKwpInv
                                projeto.save().then(() => {
                                    Acesso.find({ user: id, notped: 'checked' }).then((acesso) => {
                                        //console.log('acesso=>' + acesso)
                                        if (naoVazio(acesso)) {
                                            acesso.forEach((e) => {
                                                Pessoa.findOne({ _id: e.pessoa }).then((pessoa) => {
                                                    q++
                                                    //console.log('pessoa=>' + pessoa)
                                                    texto = 'Olá ' + pessoa.nome + ',' + '\n' +
                                                        'PEDIDO REALIZADO!' + '\n' +
                                                        'O pedido da proposta ' + projeto.seq + ' do cliente ' + cliente.nome + ' está pronto. ' + '\n ' +
                                                        'Acesse https://quasat.vimmus.com.br/gerenciamento/orcamento/' + projeto._id + ' e acompanhe.'

                                                    //console.log('pessoa.celular=>' + pessoa.celular)

                                                    client.messages
                                                        .create({
                                                            body: texto,
                                                            from: 'whatsapp:+554991832978',
                                                            to: 'whatsapp:+55' + pessoa.celular
                                                        })
                                                        .then((message) => {
                                                            //console.log('q=>' + q)
                                                            //console.log('acesso.length=>' + acesso.length)
                                                            if (q == acesso.length) {
                                                                //console.log(message.sid)
                                                                req.flash('success_msg', 'Pedido realizado com sucesso.')
                                                                res.redirect('/gerenciamento/orcamento/' + req.body.id)
                                                            }
                                                        }).done()

                                                }).catch((err) => {
                                                    req.flash('error_msg', 'Houve um erro ao encontrar a pessoa<whats>.')
                                                    res.redirect('/dashboard')
                                                })
                                            })
                                        } else {
                                            req.flash('success_msg', 'Pedido realizado com sucesso.')
                                            res.redirect('/gerenciamento/orcamento/' + req.body.id)
                                        }
                                    }).catch((err) => {
                                        req.flash('error_msg', 'Houve um erro ao encontrar o acesso.')
                                        res.redirect('/dashboard')
                                    })
                                })
                            }).catch((err) => {
                                req.flash('error_msg', 'Houve erro ao salvar o pedido.')
                                res.redirect('/gerenciamento/orcamento/' + req.body.id)
                            })
                        }).catch((err) => {
                            req.flash('error_msg', 'Houve erro ao encontrar o projeto.')
                            res.redirect('/gerenciamento/orcamento/' + req.body.id)
                        })
                    }
                } else {
                    req.flash('error_msg', 'É necessário preencher a condição de pagamento!')
                    res.redirect('/gerenciamento/orcamento/' + req.body.id)
                }
            })
        })
    }).catch((err) => {
        req.flash('error_msg', 'Houve erro ao encontrar a empresa.')
        res.redirect('/gerenciamento/orcamento/' + req.body.id)
    })
})

router.post('/filtrodash', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    const { ehAdmin } = req.user
    const { nome } = req.user
    const { owner } = req.user
    const { pessoa } = req.user
    const { vendedor } = req.user
    const { funges } = req.user
    const { funpro } = req.user
    const { funass } = req.user
    const { instalador } = req.user
    const { orcamentista } = req.user

    var id
    var sql = []
    var sqlcli = []

    var hoje = dataHoje()
    var data1 = 0
    var data2 = 0
    var days = 0
    var dif = 0
    var alerta
    var ano = hoje.substring(0, 4)
    var dtfim
    var render

    var q = 0
    var listaOrcado = []
    var listaGanho = []
    var listaBaixado = []
    var listaAberto = []
    var listaExecucao = []
    var listaEncerrado = []
    var listaEntregue = []
    var listaEnviado = []
    var listaNegociando = []
    var listaFuturos = []
    var listaTermos = []
    var notpro = []
    var atrasado = []
    var deadlineIns = []
    var dtcadastro = ''
    var dtvalidade = ''
    var saudacao
    var nome_cliente
    var nome_instalador
    var leva
    var totGanho = 0
    var totEnviado = 0
    var totPerdido = 0
    var totNegociando = 0
    let datacad

    if (ehAdmin == 0) {
        ehMaster = true
    } else {
        ehMaster = false
    }

    if (naoVazio(user)) {
        id = user
        sql = { user: id, responsavel: pessoa }
    } else {
        id = _id
        sql = { user: id }
    }

    if (vendedor) {
        // list.getClients(id, pessoa)
        sqlcli = { user: id, vendedor: pessoa, lead: true }
        render = 'dashvendedor'
    } else {
        // list.getClients(id)
        sqlcli = { user: id, lead: true }
        render = 'dashboard'
    }

    var data = new Date()
    var anoval
    var mesval
    var diaval
    var vistoria
    var leva

    var desctermo
    var datatermo
    var termo = false
    var tamTermo = []
    var dataAprova
    var contaDias
    var excedePrazo

    var data = new Date()
    var hora = data.getHours()

    //ajuste da hora no servidor para horário do cliente brasília
    hora = hora - 3

    if (hora >= 18 && hora <= 24) {
        saudacao = 'Boa Noite '
    }
    if (hora >= 12 && hora < 18) {
        saudacao = 'Boa tarde '
    }
    if (hora >= 0 && hora < 12) {
        saudacao = 'Bom dia '
    }
    var dataini
    var datafim

    var mes = req.body.mes
    var ano = req.body.ano

    switch (String(mes)) {
        case 'Janeiro':
            dataini = ano + '01' + '01'
            datafim = ano + '01' + '31'
            break;
        case 'Fevereiro':
            dataini = ano + '02' + '01'
            datafim = ano + '02' + '28'
            break;
        case 'Março':
            dataini = ano + '03' + '01'
            datafim = ano + '03' + '31'
            break;
        case 'Abril':
            dataini = ano + '04' + '01'
            datafim = ano + '04' + '30'
            break;
        case 'Maio':
            dataini = ano + '05' + '01'
            datafim = ano + '05' + '31'
            break;
        case 'Junho':
            dataini = ano + '06' + '01'
            datafim = ano + '06' + '30'
            break;
        case 'Julho':
            dataini = ano + '07' + '01'
            datafim = ano + '07' + '31'
            break;
        case 'Agosto':
            dataini = ano + '08' + '01'
            datafim = ano + '08' + '31'
            break;
        case 'Setembro':
            dataini = ano + '09' + '01'
            datafim = ano + '09' + '30'
            break;
        case 'Outubro':
            dataini = ano + '10' + '01'
            datafim = ano + '10' + '31'
            break;
        case 'Novembro':
            dataini = ano + '11' + '01'
            datafim = ano + '11' + '30'
            break;
        case 'Dezembro':
            dataini = ano + '12' + '01'
            datafim = ano + '12' + '31'
            break;
        default:
            dataini = ano + '01' + '01'
            datafim = ano + '12' + '31'
            break;
    }

    if (naoVazio(user)) {
        Acesso.findOne({ _id: _id }).then((acesso) => {
            Pessoa.findOne({ _id: acesso.pessoa }).then((logado) => {
                if (acesso.funges || acesso.orcamentista || acesso.funpro) {
                    sql = { user: id, datacad: { $lte: datafim, $gte: dataini } }
                } else {
                    sql = { user: id, vendedor: logado._id, datacad: { $lte: datafim, $gte: dataini } }
                }
                //console.log('funpro=>' + funpro)
                if (vendedor == true || funges == true || orcamentista == true || funpro == true) {
                    Projeto.find(sql).sort({ 'seq': -1 }).then((projetos) => {
                        if (naoVazio(projetos)) {
                            var id_responsavel
                            var insres
                            var nome_responsavel
                            projetos.forEach((e) => {
                                Equipe.findOne({ _id: e.equipe }).then((equipe) => {
                                    if (naoVazio(equipe)) {
                                        insres = equipe.insres
                                    } else {
                                        insres = '111111111111111111111111'
                                    }
                                    Pessoa.findOne({ _id: insres }).then((instalador) => {
                                        Pessoa.findOne({ _id: e.vendedor }).then((pes_vendedor) => {
                                            Cliente.findOne({ _id: e.cliente }).then((cliente) => {
                                                if (naoVazio(e.responsavel)) {
                                                    id_responsavel = e.responsavel
                                                } else {
                                                    id_responsavel = '111111111111111111111111'
                                                }
                                                Pessoa.findOne({ _id: id_responsavel }).then((responsavel) => {
                                                    q++
                                                    if (naoVazio(responsavel)) {
                                                        nome_responsavel = responsavel.nome
                                                    } else {
                                                        nome_responsavel = 'vazio'
                                                    }
                                                    if (naoVazio(cliente)) {
                                                        nome_cliente = cliente.nome
                                                    } else {
                                                        nome_cliente = ''
                                                    }
                                                    if (naoVazio(instalador)) {
                                                        nome_instalador = instalador.nome
                                                    } else {
                                                        nome_instalador = ''
                                                    }
                                                    if (naoVazio(e.dataApro)) {
                                                        dataAprova = e.dataApro
                                                    } else {
                                                        dataAprova = '0000-00-00'
                                                    }
                                                    if (naoVazio(e.datacad)) {
                                                        datacad = e.datacad
                                                    } else {
                                                        datacad = '0000-00-00'
                                                    }

                                                    if (e.status == 'Enviado' && e.ganho == false && naoVazio(e.motivo) == false) {
                                                        if (naoVazio(e.valor)) {
                                                            totEnviado = totEnviado + e.valor
                                                        }
                                                    }

                                                    if (e.ganho == true) {
                                                        if (naoVazio(e.valor)) {
                                                            totGanho = totGanho + e.valor
                                                        }
                                                    } else {
                                                        if (e.baixada == true) {
                                                            if (naoVazio(e.valor)) {
                                                                totPerdido = totPerdido + e.valor
                                                            }
                                                        } else {
                                                            if (e.status == 'Negociando' || e.status == 'Analisando Financiamento' || e.status == 'Comparando Propostas' || e.status == 'Aguardando redução de preço') {
                                                                if (naoVazio(e.valor)) {
                                                                    totNegociando = totNegociando + e.valor
                                                                }
                                                            }
                                                        }
                                                    }

                                                    if (e.instalado && e.encerrado != true) {
                                                        termo = false
                                                        tamTermo = e.termo
                                                        if (tamTermo.length > 0) {
                                                            if (naoVazio(tamTermo[0].data)) {
                                                                datatermo = tamTermo[0].data
                                                                desctermo = tamTermo[0].desc
                                                            } else {
                                                                datatermo = ''
                                                            }
                                                        } else {
                                                            datatermo = ''
                                                        }
                                                        if (naoVazio(e.dataTroca)) {
                                                            dataTroca = e.dataTroca
                                                            if (naoVazio(datatermo)) {
                                                                contaDias = diferencaDias(e.dataTroca, datatermo)
                                                                termo = true
                                                            } else {
                                                                contaDias = diferencaDias(e.dataTroca, dataHoje())
                                                                termo = false
                                                            }
                                                        } else {
                                                            contaDias = 0
                                                        }

                                                        if (contaDias > 14) {
                                                            excedePrazo = true
                                                        } else {
                                                            excedePrazo = false
                                                        }

                                                        listaTermos.push({ id: e._id, vendedor: pes_vendedor.nome, termo, excedePrazo, contaDias, nome_instalador, cliente: cliente.nome, desctermo, seq: e.seq, cadastro: dataMsgNum(datacad), aprovacao: dataMensagem(dataAprova), vistoria, parado: e.parado, execucao: e.execucao, encerrado: e.encerrado })
                                                    }

                                                    if ((e.entregue == true) && (e.status == 'Enviado')) {
                                                        //console.log('entregue')
                                                        alerta = false
                                                        dtfim = String(e.dtentrega)
                                                        diaval = dtfim.substring(8, 10)
                                                        mesval = dtfim.substring(5, 7) - 1
                                                        anoval = dtfim.substring(0, 4)
                                                        data2 = new Date(anoval, mesval, diaval)
                                                        data1 = new Date(data)
                                                        //console.log('data1=>' + data1)
                                                        //console.log('data2=>' + data2)
                                                        dif = Math.abs(data1.getTime() - data2.getTime())
                                                        //console.log('dif=>' + dif)
                                                        days = Math.ceil(dif / (1000 * 60 * 60 * 24))
                                                        //console.log('days=>' + days)
                                                        if (days > 7) {
                                                            alerta = true
                                                        }
                                                        //console.log(alerta)
                                                        listaEntregue.push({ id: e._id, idcliente: e.cliente, idvendedor: e.vendedor, alerta, seq: e.seq, resp: e.responsavel, cliente: nome_cliente, cadastro: dataMsgNum(datacad) })
                                                    } else {
                                                        if ((e.futuro == true) && (e.status == 'Futuro')) {
                                                            listaFuturos.push({ id: e._id, idcliente: e.cliente, idvendedor: e.vendedor, seq: e.seq, resp: e.responsavel, cliente: nome_cliente, cadastro: dataMsgNum(datacad) })
                                                        } else {
                                                            //console.log('e.execucao=>' + e.execucao)
                                                            if (e.baixada == true) {
                                                                listaBaixado.push({ id: e._id, seq: e.seq, cliente: cliente.nome, cadastro: dataMsgNum(datacad) })
                                                            } else {
                                                                //console.log('e.status=>' + e.status)
                                                                if ((e.execucao == true)) {
                                                                    // && (e.status == 'Ganho')
                                                                    //console.log('pes_ins=>'+pes_ins)

                                                                    vistoria = false
                                                                    if (naoVazio(e.dataPost) && naoVazio(e.dataSoli) && naoVazio(dataAprova)) {
                                                                        vistoria = true
                                                                    }

                                                                    if (e.instalado != true) {
                                                                        listaExecucao.push({ id: e._id, nome_instalador, cliente: cliente.nome, desctermo, seq: e.seq, cadastro: dataMsgNum(datacad), aprovacao: dataMensagem(dataAprova), vistoria, parado: e.parado, execucao: e.execucao, encerrado: e.encerrado })
                                                                    }

                                                                    if (naoVazio(vendedor)) {
                                                                        if (naoVazio(e.medidor) && naoVazio(e.disjuntor) && naoVazio(e.trafo)) {
                                                                            leva = true
                                                                        } else {
                                                                            leva = false
                                                                        }
                                                                        if (e.encerrado != true) {
                                                                            listaGanho.push({ id: e._id, leva, idcliente: e.cliente, idvendedor: e.vendedor, seq: e.seq, resp: e.responsavel, pro: e.proposta, cliente: nome_cliente, cadastro: dataMsgNum(datacad), auth: e.autorizado })
                                                                        }
                                                                    }
                                                                } else {
                                                                    if (e.ganho == true) {
                                                                        dtfim = e.dtfim
                                                                        if (naoVazio(dtfim)) {
                                                                            diaval = dtfim.substring(0, 2)
                                                                            mesval = dtfim.substring(3, 5) - 1
                                                                            anoval = dtfim.substring(6, 11)
                                                                            data2 = new Date(anoval, mesval, diaval)
                                                                            data1 = new Date(hoje)
                                                                            //console.log('data1=>' + data1)
                                                                            //console.log('data2=>' + data2)
                                                                            dif = Math.abs(data2.getTime() - data1.getTime())
                                                                            //console.log('dif=>'+dif)
                                                                            days = Math.ceil(dif / (1000 * 60 * 60 * 24))
                                                                            //console.log('days=>'+days)
                                                                            if (days < 30) {
                                                                                deadlineIns.push({ id: e._id, projeto: e.seq, cliente: cliente.nome, cadastro: dataMensagem(dtcadastro), inicio: dataMensagem(e.dtinicio), dliins: dataMensagem(e.dtfim) })
                                                                            }
                                                                        }
                                                                        if (naoVazio(e.medidor) && naoVazio(e.disjuntor) && naoVazio(e.trafo)) {
                                                                            leva = true
                                                                        } else {
                                                                            leva = false
                                                                        }
                                                                        if (e.encerrado != true) {
                                                                            listaGanho.push({ id: e._id, leva, idcliente: e.cliente, idvendedor: e.vendedor, seq: e.seq, resp: e.responsavel, auth: e.autorizado, pro: e.proposta, cliente: nome_cliente, cadastro: dataMsgNum(datacad), auth: e.autorizado })
                                                                        }
                                                                    } else {
                                                                        if ((e.baixada == false) && (e.encerrado == false)) {

                                                                            if (naoVazio(e.proposta) == false) {
                                                                                //console.log('e.proposta=>'+e.proposta)
                                                                                var proposta = e.proposta
                                                                                if (proposta.length > 0) {
                                                                                    dtcadastro = proposta[proposta.length - 1].data
                                                                                    dtvalidade = proposta[proposta.length - 1].validade
                                                                                }

                                                                                //console.log('dtvalidade=>'+dtvalidade)
                                                                                //console.log('e._id=>'+e._id)
                                                                                if (naoVazio(dtvalidade)) {
                                                                                    diaval = dtvalidade.substring(0, 2)
                                                                                    mesval = dtvalidade.substring(3, 5) - 1
                                                                                    anoval = dtvalidade.substring(6, 11)
                                                                                    data1 = new Date(anoval, mesval, diaval)
                                                                                    data2 = new Date(hoje)
                                                                                    dif = Math.abs(data1.getTime() - data2.getTime())
                                                                                    days = Math.ceil(dif / (1000 * 60 * 60 * 24))
                                                                                    if (data1.getTime() < data2.getTime()) {
                                                                                        days = days * -1
                                                                                    }
                                                                                    //console.log('days=>' + days)
                                                                                    if (days == 1 || days == 0) {
                                                                                        notpro.push({ id: e._id, seq: e.seq, status: e.status, cliente: nome_cliente, telefone: cliente.celular, cadastro: dtcadastro, validade: dtvalidade })
                                                                                    } else {
                                                                                        if (days < 0) {
                                                                                            atrasado.push({ id: e._id, seq: e.seq, status: e.status, cliente: nome_cliente, telefone: cliente.celular, cadastro: dtcadastro, validade: dtvalidade })
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }

                                                                            if (e.status == 'Negociando' || e.status == 'Analisando Financiamento' || e.status == 'Comparando Propostas' || e.status == 'Aguardando redução de preço') {
                                                                                //console.log('negociando')
                                                                                alerta = false
                                                                                dtfim = String(e.datastatus)
                                                                                diaval = dtfim.substring(8, 10)
                                                                                mesval = dtfim.substring(5, 7) - 1
                                                                                anoval = dtfim.substring(0, 4)
                                                                                data2 = new Date(anoval, mesval, diaval)
                                                                                data1 = new Date(data)
                                                                                //console.log('data1=>' + data1)
                                                                                //console.log('data2=>' + data2)
                                                                                dif = Math.abs(data1.getTime() - data2.getTime())
                                                                                //console.log('dif=>' + dif)
                                                                                days = Math.ceil(dif / (1000 * 60 * 60 * 24))
                                                                                //console.log('days=>' + days)
                                                                                if (days > 3) {
                                                                                    alerta = true
                                                                                }
                                                                                //console.log(alerta)
                                                                                listaNegociando.push({ id: e._id, idcliente: e.cliente, idvendedor: e.vendedor, alerta, cliente: cliente.nome, seq: e.seq, status: e.status, cadastro: dataMsgNum(datacad) })
                                                                            } else {
                                                                                listaEnviado.push({ id: e._id, idcliente: e.cliente, idvendedor: e.vendedor, seq: e.seq, resp: e.responsavel, pro: e.proposta, cliente: nome_cliente, cadastro: dataMsgNum(datacad) })
                                                                            }
                                                                            listaOrcado.push({ id: e._id, logado: pessoa, idcliente: e.cliente, idvendedor: e.vendedor, seq: e.seq, resp: e.responsavel, nome_responsavel, pro: e.proposta, cliente: nome_cliente, cadastro: dataMsgNum(datacad) })
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }

                                                    if (q == projetos.length) {
                                                        //console.log('lista=>' + JSON.stringify(listaExecucao))
                                                        listaEntregue.sort(comparaNum)
                                                        listaEnviado.sort(comparaNum)
                                                        listaExecucao.sort(comparaNum)
                                                        listaTermos.sort(comparaNum)
                                                        listaOrcado.sort(comparaNum)
                                                        listaGanho.sort(comparaNum)
                                                        listaNegociando.sort(comparaNum)
                                                        listaFuturos.sort(comparaNum)
                                                        //console.log('totEnviado=>' + totEnviado)
                                                        totEnviado = mascaraDecimal(totEnviado)
                                                        totGanho = mascaraDecimal(totGanho)
                                                        totPerdido = mascaraDecimal(totPerdido)
                                                        totNegociando = mascaraDecimal(totNegociando)
                                                        Empresa.findOne().sort({ field: 'asc', _id: -1 }).lean().then((empresa) => {
                                                            if (naoVazio(empresa)) {

                                                                Cliente.find(sqlcli).lean().then((todos_clientes) => {
                                                                    if (naoVazio(todos_clientes)) {
                                                                        render = todos_clientes
                                                                    }
                                                                    res.render('dashboard', { totEnviado, totGanho, totPerdido, totNegociando, render, id: _id, pessoa: pessoa, logado, empresa, ehMaster, owner: owner, ano, funass, vendedor, orcamentista, instalador, funges, funpro, block: true, nome: logado.nome, listaGanho, listaOrcado, listaEnviado, listaFuturos, listaEntregue, listaNegociando, listaBaixado, listaEncerrado, listaExecucao, listaTermos, empresa })
                                                                })
                                                            } else {
                                                                req.flash('error_msg', 'Nenhuma empresa cadastrada.')
                                                                res.render('dashboard', { id: _id, pessoa: pessoa, logado, ehMaster, owner: owner, ano, funass, vendedor, orcamentista, instalador, funges, funpro, block: true, nome: logado.nome, listaGanho, listaOrcado, listaEnviado, listaFuturos, listaEntregue, listaBaixado, listaNegociando, listaEncerrado, listaExecucao, listaTermos })
                                                            }
                                                        })
                                                    }
                                                })
                                            })
                                        })
                                    })
                                })
                            })
                        } else {
                            //console.log('sem projeto')
                            Empresa.findOne().sort({ field: 'asc', _id: -1 }).lean().then((empresa) => {
                                if (naoVazio(empresa)) {
                                    //console.log("com empresa")
                                    //console.log('sqlcli=>'+JSON.stringify(sqlcli))

                                    Cliente.find(sqlcli).lean().then((todos_clientes) => {
                                        var render = []
                                        if (naoVazio(todos_clientes)) {
                                            render = todos_clientes
                                        }
                                        res.render('dashboard', { render, totEnviado, totGanho, totPerdido, totNegociando, id: _id, empresa, ehMaster, owner: owner, ano, funges, orcamentista, vendedor, instalador, block: true, listaGanho, listaOrcado, listaBaixado, listaEncerrado, listaExecucao, notpro, atrasado })
                                    })
                                } else {
                                    //console.log("sem empresa")
                                    res.render('dashboard', { id: _id, ehMaster, owner: owner, ano, funges, orcamentista, vendedor, instalador, block: true, listaGanho, listaOrcado, listaBaixado, listaEncerrado, listaExecucao, notpro, atrasado })
                                }
                            })
                        }
                    })
                } else {
                    //SE FOR INSTALADOR
                    var clientes = []
                    Equipe.find({ user: id, insres: pessoa, feito: true, liberar: true, nome_projeto: { $exists: true } }).then((equipe) => {
                        if (naoVazio(equipe)) {
                            Pessoa.findOne({ _id: pessoa }).then((pes_ins) => {
                                equipe.forEach((e) => {
                                    Projeto.findOne({ equipe: e._id }).then((projeto) => {
                                        Pessoa.findOne({ _id: projeto.vendedor }).then((pes_ven) => {
                                            Cliente.findOne({ _id: projeto.cliente }).then((cliente) => {
                                                //console.log('e._id=>'+e._id)
                                                //console.log('projeto._id=>'+projeto._id)
                                                clientes.push({ id: cliente.id, nome: cliente.nome })
                                                if (e.prjfeito == 'true') {
                                                    listaEncerrado.push({ ativo: e.ativo, id: projeto._id, seq: projeto.seq, cliente: cliente.nome, endereco: projeto.endereco, cidade: projeto.cidade, uf: projeto.uf, dtini: dataMensagem(e.dtinicio), dtfim: dataMensagem(e.dtfim) })
                                                } else {
                                                    listaAberto.push({
                                                        ativo: e.ativo, id: projeto._id, seq: projeto.seq, cliente: cliente.nome, endereco: projeto.endereco, cidade: projeto.cidade, uf: projeto.uf, vendedor: pes_ven.nome, telhado: projeto.telhado, estrutura: projeto.telhado, inversor: projeto.plaKwpInv, modulos: projeto.plaQtdMod, potencia: projeto.plaWattMod, dtini: dataMensagem(e.dtinicio), dtfim: dataMensagem(e.dtfim)
                                                    })
                                                }
                                                q++
                                                if (q == equipe.length) {
                                                    listaAberto.sort(comparaNum)
                                                    listaEncerrado.sort(comparaNum)
                                                    Empresa.findOne().sort({ field: 'asc', _id: -1 }).lean().then((empresa) => {
                                                        if (naoVazio(empresa)) {
                                                            res.render('dashinsobra', { id: _id, empresa, instalador: true, vendedor: false, orcamentista: false, ehMaster, owner: owner, ano, block: true, nome: pes_ins.nome, clientes, listaAberto, listaEncerrado })
                                                        } else {
                                                            res.render('dashinsobra', { id: _id, instalador: true, vendedor: false, orcamentista: false, ehMaster, owner: owner, ano, block: true, nome: pes_ins.nome, clientes, listaAberto, listaEncerrado })
                                                        }
                                                    })
                                                }
                                            })
                                        })
                                    })
                                })
                            })
                        } else {
                            Empresa.findOne().sort({ field: 'asc', _id: -1 }).then((empresa) => {
                                if (naoVazio(empresa)) {
                                    res.render('dashinsobra', { id: _id, empresa, instalador: true, vendedor: false, orcamentista: false, ehMaster, owner: owner, ano, block: true })
                                } else {
                                    res.render('dashinsobra', { id: _id, instalador: true, vendedor: false, orcamentista: false, ehMaster, owner: owner, ano, block: true })
                                }
                            })
                        }
                    })
                }
            })
        })
    } else {
        Projeto.find({ user: id, datacad: { $lte: datafim, $gte: dataini } }).then((projeto) => {
            if (naoVazio(projeto)) {
                projeto.forEach((e) => {
                    Cliente.findOne({ _id: e.cliente }).then((cliente) => {
                        Equipe.findOne({ _id: e.equipe }).then((equipe) => {
                            if (naoVazio(equipe)) {
                                insres = equipe.insres
                            } else {
                                insres = '111111111111111111111111'
                            }
                            //console.log('id_res=>'+id_res)
                            if (naoVazio(e.responsavel)) {
                                id_responsavel = e.responsavel
                            } else {
                                id_responsavel = '111111111111111111111111'
                            }
                            Pessoa.findOne({ _id: id_responsavel }).then((responsavel) => {
                                Pessoa.findOne({ _id: insres }).lean().then((pes_ins) => {
                                    q++
                                    if (naoVazio(cliente)) {
                                        nome_cliente = cliente.nome
                                    } else {
                                        nome_cliente = ''
                                    }
                                    if (naoVazio(responsavel)) {
                                        nome_responsavel = responsavel.nome
                                    } else {
                                        nome_responsavel = ''
                                    }
                                    if (naoVazio(e.dataApro)) {
                                        dataAprova = e.dataApro
                                    } else {
                                        dataAprova = '0000-00-00'
                                    }
                                    if (naoVazio(e.datacad)) {
                                        datacad = e.datacad
                                    } else {
                                        datacad = '0000-00-00'
                                    }

                                    if (e.status == 'Enviado' && e.ganho == false && naoVazio(e.motivo) == false) {
                                        if (naoVazio(e.valor)) {
                                            totEnviado = totEnviado + e.valor
                                        }
                                    }

                                    if (e.ganho == true) {
                                        if (naoVazio(e.valor)) {
                                            totGanho = totGanho + e.valor
                                        }
                                    } else {
                                        if (e.baixada == true) {
                                            if (naoVazio(e.valor)) {
                                                totPerdido = totPerdido + e.valor
                                            }
                                        } else {
                                            if (e.status == 'Negociando' || e.status == 'Analisando Financiamento' || e.status == 'Comparando Propostas' || e.status == 'Aguardando redução de preço') {
                                                if (naoVazio(e.valor)) {
                                                    totNegociando = totNegociando + e.valor
                                                }
                                            }
                                        }
                                    }

                                    if (e.instalado && e.ecerrado != true) {
                                        termo = false
                                        tamTermo = e.termo
                                        if (tamTermo.length > 0) {
                                            if (naoVazio(tamTermo[0].data)) {
                                                datatermo = tamTermo[0].data
                                                desctermo = tamTermo[0].desc
                                            } else {
                                                datatermo = ''
                                            }
                                        } else {
                                            datatermo = ''
                                        }
                                        if (naoVazio(e.dataTroca)) {
                                            dataTroca = e.dataTroca
                                            if (naoVazio(datatermo)) {
                                                contaDias = diferencaDias(e.dataTroca, datatermo)
                                                termo = true
                                            } else {
                                                contaDias = diferencaDias(e.dataTroca, dataHoje())
                                                termo = false
                                            }
                                        } else {
                                            contaDias = 0
                                        }

                                        //console.log(contaDias)
                                        // if (contaDias > 6) {
                                        //     mostrar = true
                                        // } else {
                                        //     mostrar = false
                                        // }

                                        if (contaDias > 14) {
                                            excedePrazo = true
                                        } else {
                                            excedePrazo = false
                                        }

                                        listaTermos.push({ id: e._id, termo, excedePrazo, contaDias, nome_instalador, cliente: cliente.nome, desctermo, seq: e.seq, cadastro: dataMsgNum(datacad), aprovacao: dataMensagem(dataAprova), vistoria, parado: e.parado, execucao: e.execucao, encerrado: e.encerrado })
                                    }

                                    if ((e.baixada == false) && (e.encerrado == false) && (e.execucao == false)) {
                                        if ((e.ganho == true)) {
                                            dtfim = e.dtfim
                                            if (naoVazio(dtfim)) {
                                                diaval = dtfim.substring(0, 2)
                                                mesval = dtfim.substring(3, 5) - 1
                                                anoval = dtfim.substring(6, 11)
                                                data2 = new Date(anoval, mesval, diaval)
                                                data1 = new Date(hoje)
                                                //console.log('data1=>' + data1)
                                                //console.log('data2=>' + data2)
                                                dif = Math.abs(data2.getTime() - data1.getTime())
                                                //console.log('dif=>' + dif)
                                                days = Math.ceil(dif / (1000 * 60 * 60 * 24))
                                                //console.log('days=>' + days)
                                                if (days < 30) {
                                                    deadlineIns.push({ id: e._id, projeto: e.seq, cliente: cliente.nome, cadastro: dataMensagem(dtcadastro), inicio: dataMensagem(e.dtinicio), dliins: dataMensagem(e.dtfim) })
                                                }
                                            }
                                            if (naoVazio(e.medidor) && naoVazio(e.disjuntor) && naoVazio(e.trafo)) {
                                                leva = true
                                            } else {
                                                leva = false
                                            }
                                            listaGanho.push({ id: e._id, leva, seq: e.seq, resp: e.responsavel, pro: e.proposta, cliente: nome_cliente, cadastro: dataMsgNum(datacad) })
                                        } else {
                                            if (naoVazio(e.proposta)) {
                                                //console.log('e.proposta=>'+e.proposta)
                                                var proposta = e.proposta
                                                if (proposta.length > 0) {
                                                    dtcadastro = proposta[proposta.length - 1].data
                                                    dtvalidade = proposta[proposta.length - 1].validade
                                                }
                                                if (naoVazio(dtvalidade)) {
                                                    diaval = dtvalidade.substring(0, 2)
                                                    mesval = dtvalidade.substring(3, 5) - 1
                                                    anoval = dtvalidade.substring(6, 11)
                                                    data1 = new Date(anoval, mesval, diaval)
                                                    data2 = new Date(hoje)
                                                    //console.log('data1=>' + data1)
                                                    //console.log('data2=>' + data2)
                                                    dif = Math.abs(data1.getTime() - data2.getTime())
                                                    days = Math.ceil(dif / (1000 * 60 * 60 * 24))
                                                    if (data1.getTime() < data2.getTime()) {
                                                        days = days * -1
                                                    }
                                                    //console.log('days=>' + days)
                                                    if (days == 1 || days == 0) {
                                                        notpro.push({ id: e._id, seq: e.seq, status: e.status, cliente: nome_cliente, telefone: cliente.celular, cadastro: dtcadastro, validade: dtvalidade })
                                                    } else {
                                                        if (days < 0) {
                                                            atrasado.push({ id: e._id, seq: e.seq, status: e.status, cliente: nome_cliente, telefone: cliente.celular, cadastro: dtcadastro, validade: dtvalidade })
                                                        }
                                                    }
                                                }

                                            }

                                            listaOrcado.push({ id: e._id, seq: e.seq, resp: e.responsavel, nome_responsavel, pro: e.proposta, cliente: nome_cliente, cadastro: dataMsgNum(datacad) })
                                        }
                                    } else {
                                        if (e.baixado == true) {
                                            listaBaixado.push({ id: e._id, seq: e.seq, cliente: cliente.nome, cadastro: dataMsgNum(datacad) })
                                        } else {
                                            if ((e.execucao == true) && (e.instalado != true)) {
                                                // && (e.status == 'Ganho')
                                                //console.log('pes_ins=>'+pes_ins)
                                                listaExecucao.push({ id: e._id, seq: e.seq, pes_ins, cliente: cliente.nome, nome_instalador, cadastro: dataMsgNum(datacad), parado: e.parado, execucao: e.execucao, encerrado: e.encerrado })
                                            }
                                        }
                                    }
                                    if (q == projeto.length) {
                                        listaExecucao.sort(comparaNum)
                                        listaTermos.sort(comparaNum)
                                        listaOrcado.sort(comparaNum)
                                        listaGanho.sort(comparaNum)
                                        totEnviado = mascaraDecimal(totEnviado)
                                        totGanho = mascaraDecimal(totGanho)
                                        totPerdido = mascaraDecimal(totPerdido)
                                        totNegociando = mascaraDecimal(totNegociando)
                                        Empresa.findOne().sort({ field: 'asc', _id: -1 }).lean().then((empresa) => {
                                            if (naoVazio(empresa)) {
                                                //console.log('sqlcli=>'+JSON.stringify(sqlcli))
                                                Cliente.find(sqlcli).lean().then((todos_clientes) => {
                                                    var render
                                                    if (naoVazio(todos_clientes)) {
                                                        render = todos_clientes
                                                    }
                                                    res.render('dashboard', { totEnviado, totGanho, totPerdido, totNegociando, render, id: _id, pessoa, empresa, ehMaster, owner: owner, ano, block: true, listaGanho, listaOrcado, listaBaixado, listaEncerrado, listaExecucao, listaTermos, notpro, atrasado })
                                                })
                                            } else {
                                                //console.log('com empresa')
                                                res.render('dashboard', { id: _id, pessoa, ehMaster, owner: owner, ano, block: true, listaGanho, listaOrcado, listaBaixado, listaEncerrado, listaExecucao, listaTermos, notpro, atrasado })
                                            }
                                        })
                                    }
                                })
                            })
                        })
                    })
                })
            } else {
                Empresa.findOne().sort({ field: 'asc', _id: -1 }).lean().then((empresa) => {
                    if (naoVazio(empresa)) {
                        //console.log('sqlcli=>'+JSON.stringify(sqlcli))
                        Cliente.find(sqlcli).lean().then((todos_clientes) => {
                            var render
                            if (naoVazio(todos_clientes)) {
                                render = todos_clientes
                            }
                            res.render('dashboard', { render, id: _id, empresa, ehMaster, owner: owner, ano, orcamentista: true, block: true, listaGanho, listaOrcado, listaBaixado, listaEncerrado, listaExecucao, notpro, atrasado })
                        })
                    } else {
                        //console.log('sem empresa')
                        res.render('dashboard', { id: _id, ehMaster, owner: owner, ano, orcamentista: true, block: true, listaGanho, listaOrcado, listaBaixado, listaEncerrado, listaExecucao, notpro, atrasado })
                    }
                })
            }
        })
    }
})

router.post('/mensagem', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    var id

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }

    var erro = ''

    if (req.body.descricao == '') {
        erro = 'É necessário incluir a descrição da mensagem. '
    }
    if (erro != '') {
        req.flash('error_msg', erro)
        res.redirect('/dashboard')
    } else {
        const msg = {
            user: id,
            descricao: req.body.descricao
        }

        new Mensagem(msg).save().then(() => {

            req.flash('success_msg', 'Mensagem adicionada com sucesso.')
            res.redirect('/gerenciamento/mensagem/')
        }).catch((err) => {
            req.flash('error_msg', 'Não foi possível salvar a mesagem.')
            res.redirect('/dashboard')
        })
    }
})

router.get('/deletamensagem/:id', ehAdmin, (req, res) => {

    Mensagem.findOneAndDelete({ _id: req.params.id }).then(() => {
        req.flash('success_msg', 'Mensagem removida com sucesso.')
        res.redirect('/gerenciamento/mensagem')
    }).catch((err) => {
        req.flash('error_msg', 'Houve erro ao excluir a mensagem.')
        res.redirect('/gerenciamento/mensagem')
    })
})

router.get('/removeInstalador/:id', ehAdmin, (req, res) => {
    let params = (req.params.id)
    params = params.split('@')
    Projeto.findById(params[0]).then((projeto) => {
        Equipe.updateOne({ _id: projeto.equipe }, { $unset: { insres: "" } }).then(() => {
            Projeto.updateOne({ _id: params[0] }, { $unset: { ins_banco: "" } }).then(() => {
                Projeto.updateOne({ _id: params[0] }, { $set: { execucao: false, ins_real: false } }).then(() => {
                    req.flash('success_msg', 'Removido ' + params[1] + ' do projeto ' + projeto.seq + '.')
                    res.redirect('/gerenciamento/emandamento')
                })
            })
        })
    })
})

router.get('/dashInstalador', ehAdmin, async (req, res) => {
    const { user } = req.user
    const { _id } = req.user
    let id

    if (naoVazio(user)) {
        id = user
    } else {
        id = _id
    }

    let lista_instaladores = []

    let mestitulo

    let date = new Date()

    let diafim
    let diaini = '01'
    let mes = date.getMonth()
    if (mes < 10) {
        mes = '0' + String(mes)
    }
    mes = String(mes)

    let ano = date.getFullYear()
    let janeiro
    let fevereiro
    let marco
    let abril
    let maio
    let junho
    let julho
    let agosto
    let setembro
    let outubro
    let novembro
    let dezembro
    switch (mes) {
        case '01':
            diafim = '31'
            mestitulo = 'Janeiro'
            janeiro = 'active'
            break;
        case '02':
            diafim = '28'
            mestitulo = 'Fevereiro'
            fevereiro = 'active'
            break;
        case '03':
            diafim = '31'
            mestitulo = 'Março'
            marco = 'active'
            break;
        case '04':
            diafim = '30'
            mestitulo = 'Abril'
            abril = 'active'
            break;
        case '05':
            diafim = '31'
            mestitulo = 'Maio'
            maio = 'active'
            break;
        case '06':
            diafim = '30'
            mestitulo = 'Junho'
            junho = 'active'
            break;
        case '07':
            diafim = '31'
            mestitulo = 'Julho'
            julho = 'active'
            break;
        case '08':
            diafim = '31'
            mestitulo = 'Agosto'
            agosto = 'active'
            break;
        case '09':
            diafim = '30'
            mestitulo = 'Setembro'
            setembro = 'active'
            break;
        case '10':
            diafim = '31'
            mestitulo = 'Outubro'
            outubro = 'active'
            break;
        case '11':
            diafim = '30'
            mestitulo = 'Novembro'
            novembro = 'active'
            break;
        case '12':
            diafim = '31'
            mestitulo = 'Dezembro'
            dezembro = 'active'
            break;
    }

    let dtini = ano + mes + diaini
    dtini = parseFloat(dtini)
    let dtfim = ano + mes + diafim
    dtfim = parseFloat(dtfim)

    Equipe.aggregate([
        {
            $match: {
                user: id,
                "dtfimbusca": {
                    $gte: dtini,
                    $lte: dtfim
                }
            }
        },
        {
            $group: {
                _id: "$insres",
                totalQtd: { $sum: "$qtdmod" },
                count: { $sum: 1 }
            }
        },
        {
            $lookup: {
                from: 'projetos',
                let: { ins_real: "$_id" },
                pipeline: [{
                    $match: {
                        instalado: false,
                        $expr: {
                            $eq: ["$ins_banco", "$$ins_real"]
                        }
                    }
                },
                {
                    $group: {
                        _id: "$ins_banco",
                        total_qtd_banco: { $sum: "$plaQtdMod" }
                    }
                }],
                as: "banco"
            }
        },
        {
            $replaceRoot: {
                newRoot: {
                    $mergeObjects: [{
                        $arrayElemAt:
                            ["$banco", 0]
                    },
                        "$$ROOT"]
                }
            }
        },
        {
            $project: {
                banco: 0
            }
        }
    ]).then(async data => {
        let i = 0
        for (let ins of data) {
            let nome_ins = await Pessoa.findById(ins._id)
            let qtd_real = await ins.totalQtd
            let qtd_banco = await ins.total_qtd_banco
            if (naoVazio(nome_ins)) {
                lista_instaladores.push({ instalador: nome_ins.nome, qtd_real, qtd_banco, i })
                i++
            }
        }
        res.render('principal/dashInstalador', {
            lista_instaladores, mestitulo, ano,
            janeiro, fevereiro, marco, abril, maio, junho, julho, agosto, setembro, outubro, novembro, dezembro
        })
    })
})

router.post('/dashInstalador', ehAdmin, async (req, res) => {
    const { user } = req.user
    const { _id } = req.user
    let id

    if (naoVazio(user)) {
        id = user
    } else {
        id = _id
    }

    let lista_instaladores = []

    let mes
    let ano = req.body.ano

    let janeiro
    let fevereiro
    let marco
    let abril
    let maio
    let junho
    let julho
    let agosto
    let setembro
    let outubro
    let novembro
    let dezembro
    let todos

    let diafim

    //console.log(req.body.mes)

    switch (req.body.mes) {
        case 'Janeiro':
            diafim = '31'
            mes = '01'
            janeiro = 'active'
            break;
        case 'Fevereiro':
            diafim = '28'
            mes = '02'
            fevereiro = 'active'
            break;
        case 'Março':
            diafim = '31'
            mes = '03'
            marco = 'active'
            break;
        case 'Abril':
            diafim = '30'
            mes = '04'
            abril = 'active'
            break;
        case 'Maio':
            diafim = '31'
            mes = '05'
            maio = 'active'
            break;
        case 'Junho':
            diafim = '30'
            mes = '06'
            junho = 'active'
            break;
        case 'Julho':
            diafim = '31'
            mes = '07'
            julho = 'active'
            break;
        case 'Agosto':
            diafim = '31'
            mes = '08'
            agosto = 'active'
            break;
        case 'Setembro':
            diafim = '30'
            mes = '09'
            setembro = 'active'
            break;
        case 'Outubro':
            diafim = '31'
            mes = '10'
            outubro = 'active'
            break;
        case 'Novembro':
            diafim = '30'
            mes = '11'
            novembro = 'active'
            break;
        case 'Dezembro':
            diafim = '31'
            mes = '12'
            dezembro = 'active'
            break;
        default:
            diafim = '31'
            todos = 'active'
            break;
    }
    let dtini
    let dtfim

    if (todos == 'active') {
        dtini = Number(`${ano}0101`)
        dtfim = Number(`${ano}1231`)
    } else {
        dtini = Number(`${ano}${mes}01`)
        dtfim = Number(`${ano}${mes}${diafim}`)
    }

    Equipe.aggregate([
        {
            $match: {
                user: id,
                "dtfimbusca": {
                    $gte: dtini,
                    $lte: dtfim
                }
            }
        },
        {
            $group: {
                _id: "$insres",
                totalQtd: { $sum: "$qtdmod" },
                count: { $sum: 1 }
            }
        },
        {
            $lookup: {
                from: 'projetos',
                let: { ins_real: "$_id" },
                pipeline: [{
                    $match: {
                        instalado: false,
                        $expr: {
                            $eq: ["$ins_banco", "$$ins_real"]
                        }
                    }
                },
                {
                    $group: {
                        _id: "$ins_banco",
                        total_qtd_banco: { $sum: "$plaQtdMod" }
                    }
                }],
                as: "banco"
            }
        },
        {
            $replaceRoot: {
                newRoot: {
                    $mergeObjects: [
                        {
                            $arrayElemAt:
                                ["$banco", 0]
                        },
                        "$$ROOT"]
                }
            }
        },
        {
            $project: {
                banco: 0
            }
        }
    ]).then(async data => {
        let i = 0
        let mensagem

        if (naoVazio(data)) {
            for (let ins of data) {
                let nome_ins = await Pessoa.findById(ins._id)
                let qtd_real = await ins.totalQtd
                let qtd_banco = await ins.total_qtd_banco
                if (naoVazio(nome_ins)) {
                    lista_instaladores.push({ instalador: nome_ins.nome, qtd_real, qtd_banco, i })
                    i++
                }
            }
        } else {
            mensagem = 'Não existem instaladores com programação para este mês.'
        }
        res.render('principal/dashInstalador', {
            mensagem,
            lista_instaladores, mestitulo: req.body.mes, ano,
            janeiro, fevereiro, marco, abril, maio, junho, julho,
            agosto, setembro, outubro, novembro, dezembro, todos
        })
    })
})

router.post('/obsinstalacao', ehAdmin, async (req, res) => {
    let ObjectId = mongoose.Types.ObjectId;
    let reg = await Projeto.aggregate([
        {
            $match: {
                _id: ObjectId(String(req.body.id))
            }
        },
        {
            $lookup: {
                from: 'equipes',
                let: { id_equipe: '$equipe' },
                pipeline: [{
                    $match: {
                        $expr: {
                            $eq: ['$_id', "$$id_equipe"]
                        }
                    }
                }],
                as: 'equipes'
            }
        }
    ]);
    reg.map(async item => {
        if (item.equipes.length > 0) {
            let equipes = item.equipes;
            equipes.map(async i => {
                await Equipe.updateOne({ _id: i._id }, { $set: { observacao: req.body.obsins } });
            })
        } else {
            let equipe = await Equipe.findOne({ projeto: req.body.id });
            await Equipe.updateOne({ _id: equipe._id }, { $set: { observacao: req.body.obsins } });
        }
    })

    res.render('principal/obsinstalador', { idprj: req.body.id, observacao: req.body.obsins });
})

router.post('/obsprojetista', ehAdmin, async (req, res) => {
    const { pessoa } = req.user
    Projeto.findOne({ _id: req.body.idprj }).lean().then((projeto) => {
        salvarObservacao(projeto, req.body.obsprojetistamain, req.body.idprj, pessoa);
        res.redirect('/gerenciamento/emandamento')
    }).catch(() => {
        req.flash('error_msg', 'Falha ao encontrar o projeto.')
        res.redirect('/gerenciamento/projeto/' + req.params.id)
    })
})

module.exports = router 