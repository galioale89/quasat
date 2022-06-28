const express = require('express')
const app = express()

//const handlebars = require('express-handlebars')
const { engine } = require('express-handlebars')
const bodyParser = require('body-parser')
const path = require("path")
const mongoose = require('mongoose')

const session = require('express-session')
const flash = require('connect-flash')

const pessoa = require('./routes/pessoa')
const cliente = require('./routes/cliente')
const usuario = require('./routes/usuario')
const administrador = require('./routes/administrador')
const relatorios = require('./routes/relatorios')
const gerenciamento = require('./routes/gerenciamento')
const configuracao = require('./routes/configuracao')
const agenda = require('./routes/agenda')
const componente = require('./routes/componente')
const parametros = require('./routes/parametros')

const Usuario = mongoose.model('usuario')
const Projeto = mongoose.model('projeto')
const Cliente = mongoose.model('cliente')
const Pessoa = mongoose.model('pessoa')
const Equipe = mongoose.model('equipe')
const Acesso = mongoose.model('acesso')
const Pedido = mongoose.model('pedido')
const Empresa = mongoose.model('empresa')

const naoVazio = require('./resources/naoVazio')
const dataMensagem = require('./resources/dataMensagem')
const dataHoje = require('./resources/dataHoje')
const diferencaDias = require('./resources/diferencaDias')
const comparaNum = require('./resources/comparaNumeros')
const { ehAdmin } = require('./helpers/ehAdmin')
const dataMsgNum = require('./resources/dataMsgNum')
const mascaraDecimal = require('./resources/mascaraDecimal')

const ListInput = require('./api')
const list = new ListInput(mongoose, app)

// const MobileService = require('./apiService/manager')
// const mobileService = new MobileService(mongoose, app)
// mobileService.run()

//Chamando função de validação de autenticação do usuário pela função passport
const passport = require("passport")
require("./config/auth")(passport)

//Configuração
//Sessions
app.use(session({
    secret: "quasat",
    resave: true,
    saveUninitialized: true
}))
//Inicializa passport - login
app.use(passport.initialize())
app.use(passport.session())

//Flash
app.use(flash())

//Middleware
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg')
    res.locals.error_msg = req.flash('error_msg')
    res.locals.aviso_msg = req.flash('aviso_msg')
    res.locals.error = req.flash("error")
    res.locals.user = req.user || null
    next()
})

//Body-Parser
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({
    extended: true,
    limit: '100mb'
}))

//Handlebars
app.disable('x-powered-by')
app.engine('handlebars', engine({ defaultLayout: 'main' }))
//app.engine('handlebars', handlebars({ defaulLayout: "main" }))
app.set('view engine', 'handlebars')

// Essa linha faz o servidor disponibilizar o acesso às imagens via URL!
app.use(express.static('public/'))

//Mongoose DB
mongoose.Promise = global.Promise
mongoose.connect('mongodb://quasatdb:64l10770@localhost:27017/quasat?authSource=admin', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("Sucesso ao se conectar no app")
}).catch((errr) => {
    console.log("Falha ao se conectar no Mongo")
})

//Public para CSS do bootstrap
app.use(express.static(path.join(__dirname, 'public')))

//Função passport para logout
app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
})

app.get('/', (req, res) => {
    res.render('usuario/login')
})

app.get('/politica', (req, res) => {
    res.render('politica')
})

app.get('/termo', (req, res) => {
    res.render('termo')
})

//Direcionando para página principal
app.get('/dashboard', ehAdmin, (req, res) => {

    // console.log('entrou app')

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
    var render = ''

    if (naoVazio(user)) {
        id = user
        sql = { user: id, responsavel: pessoa }
    } else {
        id = _id
        sql = { user: id }
    }

    if (vendedor) {
        list.getClients(id, pessoa)
        sqlcli = { user: id, vendedor: pessoa, lead: true }
    } else {
        list.getClients(id)
        sqlcli = { user: id, lead: true }
    }

    var hoje = dataHoje()
    var data1 = 0
    var data2 = 0
    var days = 0
    var dif = 0
    var alerta
    var ano = hoje.substring(0, 4)
    var dtfim
    // console.log(id)
    var q = 0
    var listaOrcado = []
    var listaGanho = []
    var listaBaixado = []
    var listaAberto = []
    var listaExecucao = []
    var listaTermos = []
    var listaEncerrado = []
    var listaEntregue = []
    var listaEnviado = []
    var listaNegociando = []
    var listaFuturos = []
    var notpro = []
    var atrasado = []
    var deadlineIns = []
    var dtcadastro = ''
    var dtvalidade = ''
    var nome_cliente
    var nome_instalador
    var dataAprova

    var totEnviado = 0
    var totGanho = 0
    var totNegociando = 0
    var totPerdido = 0

    var ehMaster
    if (ehAdmin == 0) {
        ehMaster = true
    } else {
        ehMaster = false
    }

    let data = new Date()

    // console.log('id=>' + id)
    let anoval
    let mesval
    let diaval
    let vistoria
    let leva
    let termo = false
    let desctermo = ''
    let datatermo = ''
    let contaDias = 0
    let mostrar = false
    let excedePrazo = false
    let tamTermo
    // console.log('pessoa=>'+pessoa)
    if (naoVazio(user)) {
        Pessoa.findOne({ _id: pessoa })
            .lean()
            .then((logado) => {
                if (funges || orcamentista || funpro) {
                    sql = { user: id }
                } else {
                    sql = { user: id, vendedor: logado._id }
                }
                // console.log('orcamentista=>'+orcamentista)
                if (vendedor || funges || orcamentista || funpro) {
                    Projeto.find(sql)
                        .then((projetos) => {
                            if (naoVazio(projetos)) {
                                projetos.forEach((e) => {
                                    Equipe.findOne({ _id: e.equipe })
                                        .then((equipe) => {
                                            if (naoVazio(equipe)) {
                                                insres = equipe.insres
                                            } else {
                                                insres = '111111111111111111111111'
                                            }
                                            Pessoa.findOne({ _id: insres })
                                                .then((instalador) => {
                                                    Pessoa.findOne({ _id: e.vendedor })
                                                        .then((pes_vendedor) => {
                                                            Cliente.findOne({ _id: e.cliente })
                                                                .then((cliente) => {
                                                                    if (naoVazio(e.responsavel)) {
                                                                        id_responsavel = e.responsavel
                                                                    } else {
                                                                        id_responsavel = '111111111111111111111111'
                                                                    }
                                                                    Pessoa.findOne({ _id: id_responsavel })
                                                                        .then((responsavel) => {
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

                                                                            //DASHBOARD GESTOR
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
                                                                            //FIM DASHBOARD GESTOR

                                                                            //TERMOS DE PROJETOS 
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
                                                                                    if (naoVazio(e.dataApro)) {
                                                                                        dataAprova = e.dataApro
                                                                                    } else {
                                                                                        dataAprova = '0000-00-00'
                                                                                    }
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

                                                                                // console.log(contaDias)
                                                                                if (contaDias > 6) {
                                                                                    mostrar = true
                                                                                } else {
                                                                                    mostrar = false
                                                                                }

                                                                                if (contaDias > 14) {
                                                                                    excedePrazo = true
                                                                                } else {
                                                                                    excedePrazo = false
                                                                                }

                                                                                listaTermos.push({ id: e._id, vendedor: pes_vendedor.nome, termo, mostrar, excedePrazo, contaDias, nome_instalador, cliente: cliente.nome, desctermo, seq: e.seq, cadastro: dataMsgNum(e.datacad), aprovacao: dataMensagem(dataAprova), vistoria, parado: e.parado, execucao: e.execucao, encerrado: e.encerrado })
                                                                            }
                                                                            //FIM TERMOS

                                                                            if ((e.entregue) && (e.status == 'Enviado')) {
                                                                                alerta = false
                                                                                dtfim = String(e.dtentrega)
                                                                                diaval = dtfim.substring(8, 10)
                                                                                mesval = dtfim.substring(5, 7) - 1
                                                                                anoval = dtfim.substring(0, 4)
                                                                                data2 = new Date(anoval, mesval, diaval)
                                                                                data1 = new Date(data)
                                                                                dif = Math.abs(data1.getTime() - data2.getTime())
                                                                                days = Math.ceil(dif / (1000 * 60 * 60 * 24))
                                                                                listaEntregue.push({ 
                                                                                    id: e._id, 
                                                                                    idcliente: e.cliente, 
                                                                                    idvendedor: e.vendedor, 
                                                                                    alerta: true, 
                                                                                    seq: e.seq, 
                                                                                    resp: e.responsavel, 
                                                                                    cliente: nome_cliente, 
                                                                                    cadastro: dataMsgNum(e.datacad) 
                                                                                })
                                                                            } else {
                                                                                if ((e.futuro == true) && (e.status == 'Futuro')) {
                                                                                    listaFuturos.push({
                                                                                        id: e._id,
                                                                                        idcliente: e.cliente,
                                                                                        idvendedor: e.vendedor,
                                                                                        seq: e.seq,
                                                                                        resp: e.responsavel,
                                                                                        cliente: nome_cliente,
                                                                                        cadastro: dataMsgNum(e.datacad)
                                                                                    })
                                                                                    listaOrcado.push({
                                                                                        id: e._id,
                                                                                        logado: pessoa,
                                                                                        idcliente: e.cliente,
                                                                                        idvendedor: e.vendedor,
                                                                                        seq: e.seq,
                                                                                        nome_responsavel,
                                                                                        resp: e.responsavel,
                                                                                        pro: e.proposta,
                                                                                        cliente: nome_cliente,
                                                                                        cadastro: dataMsgNum(e.datacad)
                                                                                    })
                                                                                } else {
                                                                                    if (e.baixada) {
                                                                                        listaBaixado.push({
                                                                                            id: e._id,
                                                                                            seq: e.seq,
                                                                                            cliente: cliente.nome,
                                                                                            cadastro: dataMsgNum(e.datacad)
                                                                                        })
                                                                                    } else {
                                                                                        if (e.execucao) {
                                                                                            vistoria = false
                                                                                            if (naoVazio(e.dataPost) && naoVazio(e.dataSoli) && naoVazio(e.dataApro)) {
                                                                                                vistoria = true
                                                                                            }
                                                                                            if (e.instalado != true) {
                                                                                                listaExecucao.push({
                                                                                                    id: e._id,
                                                                                                    nome_instalador,
                                                                                                    cliente: cliente.nome,
                                                                                                    desctermo,
                                                                                                    seq: e.seq,
                                                                                                    cadastro: dataMsgNum(e.datacad),
                                                                                                    aprovacao: dataMensagem(dataAprova),
                                                                                                    vistoria,
                                                                                                    parado: e.parado,
                                                                                                    execucao: e.execucao,
                                                                                                    encerrado: e.encerrado
                                                                                                })
                                                                                            }
                                                                                            cliente.log('nome_cliente=>'+nome_cliente)
                                                                                            if (vendedor) {
                                                                                                if (naoVazio(e.medidor) && naoVazio(e.disjuntor) && naoVazio(e.trafo)) {
                                                                                                    leva = true
                                                                                                } else {
                                                                                                    leva = false
                                                                                                }
                                                                                                if (e.encerrado != true) {
                                                                                                    listaGanho.push({ 
                                                                                                        id: e._id, 
                                                                                                        leva, 
                                                                                                        idcliente: e.cliente, 
                                                                                                        idvendedor: e.vendedor, 
                                                                                                        seq: e.seq, 
                                                                                                        resp: e.responsavel, 
                                                                                                        pro: e.proposta, 
                                                                                                        cliente: nome_cliente, 
                                                                                                        cadastro: dataMsgNum(e.datacad), 
                                                                                                        auth: e.autorizado 
                                                                                                    })
                                                                                                }
                                                                                            }
                                                                                        } else {
                                                                                            if (e.ganho) {
                                                                                                if (naoVazio(e.medidor) && naoVazio(e.disjuntor) && naoVazio(e.trafo)) {
                                                                                                    leva = true
                                                                                                } else {
                                                                                                    leva = false
                                                                                                }
                                                                                                if (e.encerrado != true) {
                                                                                                    listaGanho.push({
                                                                                                        id: e._id,
                                                                                                        leva,
                                                                                                        idcliente: e.cliente,
                                                                                                        idvendedor: e.vendedor,
                                                                                                        seq: e.seq,
                                                                                                        resp: e.responsavel,
                                                                                                        auth: e.autorizado,
                                                                                                        pro: e.proposta,
                                                                                                        cliente: nome_cliente,
                                                                                                        cadastro: dataMsgNum(e.datacad)
                                                                                                    })
                                                                                                }
                                                                                            } else {
                                                                                                if ((e.baixada == false) && (e.encerrado == false)) {
                                                                                                    if (naoVazio(e.proposta) == false) {
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
                                                                                                            dif = Math.abs(data1.getTime() - data2.getTime())
                                                                                                            days = Math.ceil(dif / (1000 * 60 * 60 * 24))
                                                                                                            if (data1.getTime() < data2.getTime()) {
                                                                                                                days = days * -1
                                                                                                            }
                                                                                                            // console.log('days=>' + days)
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
                                                                                                        // console.log('negociando')
                                                                                                        alerta = false
                                                                                                        dtfim = String(e.datastatus)
                                                                                                        diaval = dtfim.substring(8, 10)
                                                                                                        mesval = dtfim.substring(5, 7) - 1
                                                                                                        anoval = dtfim.substring(0, 4)
                                                                                                        data2 = new Date(anoval, mesval, diaval)
                                                                                                        data1 = new Date(data)
                                                                                                        dif = Math.abs(data1.getTime() - data2.getTime())
                                                                                                        days = Math.ceil(dif / (1000 * 60 * 60 * 24))
                                                                                                        if (days > 3) {
                                                                                                            alerta = true
                                                                                                        }
                                                                                                        listaNegociando.push({
                                                                                                            id: e._id,
                                                                                                            idcliente: e.cliente,
                                                                                                            idvendedor: e.vendedor,
                                                                                                            alerta,
                                                                                                            cliente: cliente.nome,
                                                                                                            seq: e.seq,
                                                                                                            status: e.status,
                                                                                                            cadastro: dataMsgNum(e.datacad)
                                                                                                        })
                                                                                                    } else {
                                                                                                        listaEnviado.push({
                                                                                                            id: e._id,
                                                                                                            idcliente: e.cliente,
                                                                                                            idvendedor: e.vendedor,
                                                                                                            seq: e.seq,
                                                                                                            resp: e.responsavel,
                                                                                                            pro: e.proposta,
                                                                                                            cliente: nome_cliente,
                                                                                                            cadastro: dataMsgNum(e.datacad)
                                                                                                        })
                                                                                                    }
                                                                                                    listaOrcado.push({
                                                                                                        id: e._id,
                                                                                                        logado: pessoa,
                                                                                                        idcliente: e.cliente,
                                                                                                        idvendedor: e.vendedor,
                                                                                                        seq: e.seq,
                                                                                                        resp: e.responsavel,
                                                                                                        nome_responsavel,
                                                                                                        pro: e.proposta,
                                                                                                        cliente: nome_cliente,
                                                                                                        cadastro: dataMsgNum(e.datacad)
                                                                                                    })

                                                                                                }
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }

                                                                            if (q == projetos.length) {
                                                                                listaEntregue.sort(comparaNum)
                                                                                listaEnviado.sort(comparaNum)
                                                                                listaExecucao.sort(comparaNum)
                                                                                listaTermos.sort(comparaNum)
                                                                                listaOrcado.sort(comparaNum)
                                                                                listaGanho.sort(comparaNum)
                                                                                listaNegociando.sort(comparaNum)
                                                                                listaFuturos.sort(comparaNum)
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
                                // console.log('sem projeto')
                                Empresa.findOne()
                                    .sort({ field: 'asc', _id: -1 }).lean()
                                    .then((empresa) => {
                                        if (naoVazio(empresa)) {
                                            // console.log("com empresa")
                                            // console.log('sqlcli=>'+JSON.stringify(sqlcli))

                                            Cliente.find(sqlcli).lean().then((todos_clientes) => {
                                                var render = []
                                                if (naoVazio(todos_clientes)) {
                                                    render = todos_clientes
                                                }
                                                res.render('dashboard', { render, totEnviado, totGanho, totPerdido, totNegociando, id: _id, empresa, ehMaster, owner: owner, ano, funges, orcamentista, vendedor, instalador, block: true, listaGanho, listaOrcado, listaBaixado, listaEncerrado, listaExecucao, notpro, atrasado })
                                            })
                                        } else {
                                            // console.log("sem empresa")
                                            res.render('dashboard', { id: _id, ehMaster, owner: owner, ano, funges, orcamentista: funcaoOrc, vendedor, instalador, block: true, listaGanho, listaOrcado, listaBaixado, listaEncerrado, listaExecucao, notpro, atrasado })
                                        }
                                    })
                            }
                        })
                } else {
                    //SE FOR INSTALADOR
                    var clientes = []
                    Equipe.find(
                        {
                            user: id,
                            insres: pessoa,
                            feito: true,
                            liberar: true,
                            nome_projeto: { $exists: true },
                            $and: [
                                {
                                    'dtinicio': { $ne: '' }
                                },
                                {
                                    'dtinicio': { $ne: '0000-00-00' }
                                }
                            ]
                        })
                        .then((equipe) => {
                            if (naoVazio(equipe)) {
                                Pessoa.findOne({ _id: pessoa })
                                    .then((pes_ins) => {
                                        equipe.forEach((e) => {
                                            Projeto.findOne({ equipe: e._id })
                                                .then((projeto) => {
                                                    Pessoa.findOne({ _id: projeto.vendedor })
                                                        .then((pes_ven) => {
                                                            Cliente.findOne({ _id: projeto.cliente })
                                                                .then((cliente) => {
                                                                    // console.log('e._id=>'+e._id)
                                                                    // console.log('projeto._id=>'+projeto._id)
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
                                                                        Empresa.findOne()
                                                                            .sort({ field: 'asc', _id: -1 }).lean().then((empresa) => {
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

    } else {
        Projeto.find({ user: id })
            .then((projeto) => {
                if (naoVazio(projeto)) {
                    projeto.forEach((e) => {
                        Cliente.findOne({ _id: e.cliente })
                            .then((cliente) => {
                                Equipe.findOne({ _id: e.equipe })
                                    .then((equipe) => {
                                        var id_responsavel
                                        var insres
                                        var nome_responsavel
                                        if (naoVazio(equipe)) {
                                            insres = equipe.insres
                                        } else {
                                            insres = '111111111111111111111111'
                                        }
                                        // console.log('id_res=>'+id_res)
                                        if (naoVazio(e.responsavel)) {
                                            id_responsavel = e.responsavel
                                        } else {
                                            id_responsavel = '111111111111111111111111'
                                        }
                                        Pessoa.findOne({ _id: id_responsavel })
                                            .then((responsavel) => {
                                                Pessoa.findOne({ _id: insres }).lean()
                                                    .then((pes_ins) => {
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
                                                        q++

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
                                                                if (naoVazio(e.dataApro)) {
                                                                    dataAprova = e.dataApro
                                                                } else {
                                                                    dataAprova = '0000-00-00'
                                                                }
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

                                                            // console.log(contaDias)
                                                            if (contaDias > 6) {
                                                                mostrar = true
                                                            } else {
                                                                mostrar = false
                                                            }

                                                            if (contaDias > 14) {
                                                                excedePrazo = true
                                                            } else {
                                                                excedePrazo = false
                                                            }

                                                            listaTermos.push({ id: e._id, termo, mostrar, excedePrazo, contaDias, nome_instalador, cliente: cliente.nome, desctermo, seq: e.seq, cadastro: dataMsgNum(e.datacad), aprovacao: dataMensagem(dataAprova), vistoria, parado: e.parado, execucao: e.execucao, encerrado: e.encerrado })
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
                                                                    // console.log('data1=>' + data1)
                                                                    // console.log('data2=>' + data2)
                                                                    dif = Math.abs(data2.getTime() - data1.getTime())
                                                                    // console.log('dif=>' + dif)
                                                                    days = Math.ceil(dif / (1000 * 60 * 60 * 24))
                                                                    // console.log('days=>' + days)
                                                                    if (days < 30) {
                                                                        deadlineIns.push({ id: e._id, projeto: e.seq, cliente: cliente.nome, cadastro: dataMensagem(dtcadastro), inicio: dataMensagem(e.dtinicio), dliins: dataMensagem(e.dtfim) })
                                                                    }
                                                                }
                                                                if (naoVazio(e.medidor) && naoVazio(e.disjuntor) && naoVazio(e.trafo)) {
                                                                    leva = true
                                                                } else {
                                                                    leva = false
                                                                }
                                                                listaGanho.push({ id: e._id, leva, seq: e.seq, resp: e.responsavel, pro: e.proposta, cliente: nome_cliente, cadastro: dataMsgNum(e.datacad) })
                                                            } else {
                                                                if (naoVazio(e.proposta)) {
                                                                    // console.log('e.proposta=>'+e.proposta)
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
                                                                        // console.log('data1=>' + data1)
                                                                        // console.log('data2=>' + data2)
                                                                        dif = Math.abs(data1.getTime() - data2.getTime())
                                                                        days = Math.ceil(dif / (1000 * 60 * 60 * 24))
                                                                        if (data1.getTime() < data2.getTime()) {
                                                                            days = days * -1
                                                                        }
                                                                        // console.log('days=>' + days)
                                                                        if (days == 1 || days == 0) {
                                                                            notpro.push({ id: e._id, seq: e.seq, status: e.status, cliente: nome_cliente, telefone: cliente.celular, cadastro: dtcadastro, validade: dtvalidade })
                                                                        } else {
                                                                            if (days < 0) {
                                                                                atrasado.push({ id: e._id, seq: e.seq, status: e.status, cliente: nome_cliente, telefone: cliente.celular, cadastro: dtcadastro, validade: dtvalidade })
                                                                            }
                                                                        }
                                                                    }

                                                                }

                                                                listaOrcado.push({ id: e._id, seq: e.seq, resp: e.responsavel, nome_responsavel, pro: e.proposta, cliente: nome_cliente, cadastro: dataMsgNum(e.datacad) })
                                                            }
                                                        } else {
                                                            if (e.baixado == true) {
                                                                listaBaixado.push({ id: e._id, seq: e.seq, cliente: cliente.nome, cadastro: dataMsgNum(e.datacad) })
                                                            } else {
                                                                if ((e.execucao == true) && (e.instalado != true)) {
                                                                    // && (e.status == 'Ganho')
                                                                    // console.log('pes_ins=>'+pes_ins)
                                                                    listaExecucao.push({ id: e._id, seq: e.seq, pes_ins, cliente: cliente.nome, nome_instalador, cadastro: dataMsgNum(e.datacad), parado: e.parado, execucao: e.execucao, encerrado: e.encerrado })
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
                                                                    // console.log('sqlcli=>'+JSON.stringify(sqlcli))
                                                                    Cliente.find(sqlcli).lean().then((todos_clientes) => {
                                                                        var render
                                                                        if (naoVazio(todos_clientes)) {
                                                                            render = todos_clientes
                                                                        }
                                                                        res.render('dashboard', { totEnviado, totGanho, totPerdido, totNegociando, render, id: _id, pessoa, empresa, ehMaster, owner: owner, ano, block: true, listaGanho, listaOrcado, listaBaixado, listaEncerrado, listaExecucao, listaTermos, notpro, atrasado })
                                                                    })
                                                                } else {
                                                                    // console.log('com empresa')
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
                            // console.log('sqlcli=>'+JSON.stringify(sqlcli))
                            Cliente.find(sqlcli).lean().then((todos_clientes) => {
                                var render
                                if (naoVazio(todos_clientes)) {
                                    render = todos_clientes
                                }
                                res.render('dashboard', { render, id: _id, empresa, ehMaster, owner: owner, ano, orcamentista: true, block: true, listaGanho, listaOrcado, listaBaixado, listaEncerrado, listaExecucao, notpro, atrasado })
                            })
                        } else {
                            // console.log('sem empresa')
                            res.render('dashboard', { id: _id, ehMaster, owner: owner, ano, orcamentista: true, block: true, listaGanho, listaOrcado, listaBaixado, listaEncerrado, listaExecucao, notpro, atrasado })
                        }
                    })
                }
            })
    }
})

//Rotas
app.use('/configuracao', configuracao)
app.use('/gerenciamento', gerenciamento)
app.use('/pessoa', pessoa)
app.use('/cliente', cliente)
app.use('/usuario', usuario)
app.use('/administrador', administrador)
app.use('/relatorios/', relatorios)
app.use('/agenda/', agenda)
app.use('/componente/', componente)
app.use('/parametros/', parametros)

//Outros

const APP_PORT = process.env.APP_PORT || 3001

app.listen(APP_PORT, () => {
    // console.log(`Running app at port:${APP_PORT}`)
})