const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const xl = require('excel4node')

require('../model/Cliente')
require('../model/Usina')
require('../model/Tarefas')
require('../model/Plano')
require('../model/Projeto')
require('../model/Servico')
require('../model/Programacao')

const Cliente = mongoose.model('cliente')
const Usina = mongoose.model('usina')
const Tarefa = mongoose.model('tarefas')
const Plano = mongoose.model('plano')
const Projeto = mongoose.model('projeto')
const Servico = mongoose.model('servico')
const Programacao = mongoose.model('programacao')
const Pessoa = mongoose.model('pessoa')

const naoVazio = require('../resources/naoVazio')
const dataBusca = require('../resources/dataBusca')
const buscaPrimeira = require('../resources/buscaPrimeira')
const setData = require('../resources/setData')
const dataMensagem = require('../resources/dataMensagem')
const dataHoje = require('../resources/dataHoje')
const { ehAdmin } = require('../helpers/ehAdmin')

router.get('/consulta', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    const { vendedor } = req.user
    const { pessoa } = req.user
    var id
    var idpes
    var sql = {}
    var clientes = []
    var q = 0

    if (typeof user == 'undefined') {
        id = _id
        sql = { user: id }
    } else {
        id = user
        idpes = pessoa
        if (String(vendedor).length == 4) {
            sql = { user: id, vendedor: idpes }
        } else {
            sql = { user: id }
        }
    }


    Cliente.aggregate([
        {
            $match: sql
        },
        {
            $lookup: {
                from: 'pessoas',
                let: {id_vendedor: '$vendedor'},
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: ["$_id","$$id_vendedor"]
                            }
                        }
                    },
                    {
                        $project: {
                            nome: 1
                        }
                    }
                ],
                as: 'vendedor'
            }
        },

    ]).then(result => {
        console.log("result=>"+result)
        result.map(e => {
            clientes.push({ _id: e._id, nome: e.nome, cidade: e.cidade, uf: e.uf, contato: e.contato, celular: e.celular, vendedor: e.vendedor.nome })
        })
        res.render('cliente/consulta', { clientes })
    })
})

router.get('/programacao/:id', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    const { nome } = req.user
    var id

    //console.log('entrou programação')

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }

    var tarefas = []
    var q = 0
    Servico.find({ user: id }).lean().then((servico) => {
        Usina.findOne({ _id: req.params.id }).lean().then((usina) => {
            Cliente.findOne({ _id: usina.cliente }).lean().then((cliente) => {
                if (naoVazio(servico)) {
                    Tarefa.find({ usina: req.params.id, concluido: false, responsavel: id, programacao: { $exists: true } }).then((t) => {
                        //console.log('t=>' + t)
                        if (naoVazio(t)) {
                            t.forEach((e) => {
                                Servico.findOne({ _id: e.servico }).then((atv) => {
                                    //console.log('e._id=>' + e._id)
                                    q++
                                    tarefas.push({ id: e._id, usina: usina._id, seq: q, dataini: e.dataini, idser: atv._id, servico: atv.descricao, responsavel: nome })
                                    if (q == t.length) {
                                        res.render('cliente/programacao', { usina, servico, tarefas, cliente, tipo: 'auto' })
                                    }
                                }).catch((err) => {
                                    req.flash('error_msg', 'Não foi possível encontrar a atividade.')
                                    res.redirect('/cliente/novo')
                                })
                            })
                        } else {
                            //console.log('usina=>' + usina)
                            //console.log('servico=>' + servico)
                            //console.log('cliente=>' + cliente)
                            res.render('cliente/programacao', { usina, servico, cliente, tipo: 'auto' })
                        }
                    }).catch((err) => {
                        req.flash('error_msg', 'Não foi possível encontrar a tarefa.')
                        res.redirect('/cliente/novo')
                    })
                } else {
                    req.flash('error_msg', 'Não encontramos tipos de serviços cadastradas. Acesse o módulo de manutenção e cadastre um tipo de serviço.')
                    res.redirect('/menu')
                }
            }).catch((err) => {
                req.flash('error_msg', 'Não foi possível encontrar o cliente.')
                res.redirect('/cliente/novo')
            })
        }).catch((err) => {
            req.flash('error_msg', 'Não foi possível encontrar o usina.')
            res.redirect('/cliente/novo')
        })
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar os serviços.')
        res.redirect('/cliente/novo')
    })
})

router.get('/novo', ehAdmin, (req, res) => {
    const { vendedor } = req.user
    var checkCPF = 'checked'
    var checkCNPJ = 'unchecked'
    var ehcpf = ''
    var ehcnpj = 'none'

    res.render('cliente/cliente', { vendedor, checkCPF, checkCNPJ, ehcpf, ehcnpj })
})

router.get('/novo/:tipo', ehAdmin, (req, res) => {
    res.render('cliente/cliente', { voltar: req.params.tipo })
})

router.post('/novo', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    const { pessoa } = req.user
    var id

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }
    var erros = []
    if (naoVazio(req.body.cnpj) || naoVazio(req.body.cpf)) {
        if (req.body.cnpj != '') {
            documento = req.body.cnpj
        } else {
            documento = req.body.cpf
        }
    }
    // } else {
    //     documento = '571.127.190-38'
    // }
    if (req.body.nome == '' || req.body.cidade == '' || req.body.celular == '') {
        req.flash('error_msg', 'Os campos de: nome, cidade e um telefone são obrigatórios.')
        res.redirect('/cliente/novo')
    } else {
        // console.log('req.body.endereco=>' + req.body.endereco)
        // console.log('req.body.celular=>' + req.body.celular)
        Cliente.findOne({ $or: [{ cpf: req.body.cpf }, { cnpj: req.body.cnpj }] }).then((cliente_end) => {
            console.log('cliente_end=>' + cliente_end)
            if (naoVazio(cliente_end)) {
                req.flash('error_msg', 'CPF ou CNPJ já cadastrado.')
                res.redirect('/cliente/edicao/' + cliente_end._id)
            } else {
                console.log('não encontrou o cliente')
                var cnpj
                var cpf
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

                // console.log('checkLead=>' + req.body.checkLead)
                // var lead = false
                // if (req.body.checkLead != null) {
                //     lead = true
                // }
                var nome = buscaPrimeira(req.body.nome)
                console.log('nome=>' + nome)
                const corpo = {
                    user: id,
                    nome: nome,
                    vendedor: pessoa,
                    endereco: req.body.endereco,
                    cep: req.body.cep,
                    numero: req.body.numero,
                    bairro: req.body.bairro,
                    complemento: req.body.complemento,
                    cidade: req.body.cidade,
                    uf: req.body.uf,
                    cnpj: cnpj,
                    cpf: cpf,
                    inscricao: req.body.inscricao,
                    contato: req.body.contato,
                    celular: req.body.celular,
                    email: req.body.email,
                    lead: true,
                }

                new Cliente(corpo).save().then(() => {
                    Cliente.findOne({ user: id }).sort({ field: 'asc', _id: -1 }).lean().then((cliente) => {
                        req.flash('success_msg', 'Cliente adicionado com sucesso')
                        res.redirect('/cliente/edicao/' + cliente._id)
                    }).catch((err) => {
                        req.flash('error_msg', 'Não foi possível encontrar o cliente.')
                        res.redirect('/cliente/edicao/' + cliente._id)
                    })
                }).catch((err) => {
                    req.flash('error_msg', 'Não foi possível cadastrar o cliente.')
                    res.redirect('/cliente/novo')
                })
            }
        }).catch((err) => {
            req.flash('error_msg', 'Não foi possível encontrar o cliente.')
            res.redirect('/cliente/novo')
        })

    }
})

router.post('/buscaNomeCliente', ehAdmin, (req,res) => {
    const { _id } = req.user
    const { user } = req.user
    var id

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }

    Cliente.findOne({nome: req.body.nome, user: id})
    .then((cliente)=>{
        res.redirect('/cliente/edicao/'+cliente._id)
    }).catch((err)=>{
        req.flash('error_msg','Falha ao encontrar o cliente.')
        res.redirect('/dashboard')
    })
})

router.get('/edicao/:id', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    const { vendedor } = req.user
    var id

    var checkCPF = 'unchecked'
    var checkCNPJ = 'unchecked'
    var ehcpf = ''
    var ehcnpj = ''

    var projetos = []

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }
    Cliente.findOne({ user: id, _id: req.params.id }).lean().then((cliente) => {
        if (cliente.cpf != 0 || cliente.cnpj != 0) {
            if (cliente.cpf != '0') {
                checkCPF = 'checked'
                ehcpf = ''
                ehcnpj = 'none'
            } else {
                checkCNPJ = 'checked'
                ehcpf = 'none'
                ehcnpj = ''
            }
        } else {
            checkCNPJ = 'unchecked'
            checkCPF = 'checked'
            ehcpf = ''
            ehcnpj = 'none'
        }
        Usina.find({ cliente: req.params.id }).lean().then((usina) => {
            Projeto.find({ cliente: cliente._id }).lean().then((projeto) => {
                projeto.forEach((e) => {
                    if (e.ampliacao) {
                        tipo = 'Ampliação'
                    } else {
                        tipo = 'Novo'
                    }
                    projetos.push({ id: e._id, seq: e.seq, tipo: tipo, potencia: e.potencia, plaQtdMod: e.plaQtdMod, plaKwpInv: e.plaKwpInv, datacad: e.datacad })
                })
                res.render('cliente/cliente', { cliente, checkCPF, checkCNPJ, ehcpf, ehcnpj, vendedor, usina, projetos })
            }).catch((err) => {
                req.flash('error_msg', 'Não foi possível encontrar os projetos.')
                res.redirect('/dashboard')
            })
        }).catch((err) => {
            req.flash('error_msg', 'Não foi possível encontrar a usina.')
            res.redirect('/cliente/novo')
        })
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar o cliente.')
        res.redirect('/cliente/novo')
    })
})

router.get('/historico/:id', ehAdmin, (req, res) => {
    var qcont = 0
    var total = 0
    var q = 0
    var emaberto = []
    var concluido = []
    var temtarefa = false
    var datafim
    Cliente.findOne({ _id: req.params.id }).lean().then((cliente) => {
        Projeto.findOne({ cliente: cliente._id }).then((projeto) => {
            // Usina.find({ cliente: req.params.id }).then((usina) => {
            //     //console.log('usina=>'+usina)
            //     if (naoVazio(usina)) {
            //         usina.forEach((e) => {
            Tarefa.find({ cliente: req.params.id }).then((tarefas) => {

                // if (naoVazio(tarefas)) {
                tarefas.forEach((et) => {
                    console.log('tarefas=>' + et._id)
                    Servico.findOne({ _id: et.servico }).then((atv) => {
                        temtarefa = true
                        q++
                        console.log('et.concluido=>' + et.concluido)
                        //console.log('e.nome=>' + e.nome}
                        console.log('et.servico=>' + et.servico)
                        if (naoVazio(et.datafim)) {
                            datafim = dataMensagem(et.datafim)
                        } else {
                            datafim = 'Sem data'
                        }
                        console.log("datafim=>" + datafim)
                        if (et.concluido == false) {
                            emaberto.push({ id: et._id, servico: atv.descricao, datafim, dataini: dataMensagem(et.dataini), situacao: "Em aberto" })
                        } else {
                            concluido.push({ id: et._id, servico: atv.descricao, datafim, dataini: dataMensagem(et.dataini), situacao: "Realizado" })
                        }
                        // qcont = q * usina.length
                        // total = usina.length * tarefas.length
                        //console.log('todas_tarefas=>'+todas_tarefas.length)
                        console.log('q=>' + q)
                        if (q == tarefas.length) {
                            //console.log('emaberto=>'+emaberto)
                            //console.log('concluido=>'+concluido)
                            //console.log('entrou')
                            res.render('cliente/historico', { emaberto, concluido, cliente, projeto })
                        }
                    }).catch((err) => {
                        req.flash('error_msg', 'Não foi possível encontrar a atividade.')
                        res.redirect('/cliente/edicao/' + req.params.id)
                    })
                })
                // if (temtarefa == false) {
                //     res.render('cliente/historico', { emaberto, concluido, cliente })
                // }
                // } else {
                //     res.render('cliente/historico', { cliente })
                // }
            }).catch((err) => {
                req.flash('error_msg', 'Não foi possível encontrar a tarefa.')
                res.redirect('/cliente/edicao/' + req.params.id)
            })
            // })
            //     } else {
            //         res.render('cliente/historico', { cliente })
            //     }
            // }).catch((err) => {
            //     req.flash('error_msg', 'Não foi possível encontrar a usina.')
            //     res.redirect('/cliente/edicao/' + req.params.id)
            // })
        }).catch((err) => {
            req.flash('error_msg', 'Não foi possível encontrar o projeto.')
            res.redirect('/cliente/edicao/' + req.params.id)
        })
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar o cliente.')
        res.redirect('/cliente/edicao/' + req.params.id)
    })

})

router.get('/confirmaexclusao/:id', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    var id

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }
    // Projeto.find({ user: id, cliente: req.params.id, proposta: {$exists: true}}).then((projeto) => {
    //     if (naoVazio(projeto)) {
    //         req.flash('aviso_msg', 'Cliente vinculado a projeto(s). Impossível excluir.')
    //         res.redirect('/cliente/consulta')
    //     } else {
    Cliente.findOne({ user: id, _id: req.params.id }).lean().then((cliente) => {
        res.render('cliente/confirmaexclusao', { cliente: cliente })
    }).catch((err) => {
        req.flash('error_msg', 'Houve um erro ao encontrar o Cliente.')
        res.redirect('/cliente/consulta')
    })
    //     }
    // }).catch((err) => {
    //     req.flash('error_msg', 'Houve um erro ao encontrar a Projeto.')
    //     res.redirect('/menu')
    // })
})

router.get('/usinas/:id', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    var id
    if (naoVazio(user)) {
        id = user
    } else {
        id = _id
    }

    var lista_usina = []
    var q = 0
    var nome_plano
    var mensalidade

    //console.log('req.params.id=>' + req.params.id)
    Projeto.findOne({ cliente: req.params.id }).lean().then((projeto) => {
        Cliente.findOne({ _id: req.params.id }).lean().then((cliente) => {
            Plano.find({ user: id }).lean().lean().then((plano) => {
                Usina.find({ cliente: req.params.id }).then((usina) => {
                    console.log('usina=>' + usina)
                    if (naoVazio(usina)) {
                        usina.forEach((e) => {
                            Plano.findOne({ _id: e.plano }).then((lista_plano) => {
                                q++
                                if (naoVazio(lista_plano)) {
                                    nome_plano = lista_plano.nome
                                    mensalidade = lista_plano.mensalidade
                                } else {
                                    nome_plano = ''
                                    mensalidade = 0
                                }
                                lista_usina.push({ id: e._id, cliente: e.cliente, datalimp: e.datalimp, datarevi: e.datarevi, cadastro: e.cadastro, classificacao: e.classificacao, tipo: e.tipo, nome_plano, mensalidade, nome: e.nome, endereco: e.endereco, area: e.area, qtdmod: e.qtdmod })
                                if (usina.length == q) {
                                    res.render('cliente/usina', { lista_usina, plano, cliente, projeto })
                                }
                            }).catch((err) => {
                                req.flash('error_msg', 'Houve uma falha ao encontrar o plano.')
                                res.redirect('/cliente/usinas/' + req.params.id)
                            })
                        })
                    } else {
                        res.render('cliente/usina', { cliente, plano, projeto })
                    }
                }).catch((err) => {
                    req.flash('error_msg', 'Houve uma falha ao encontrar a usina.')
                    res.redirect('/cliente/usinas/' + req.params.id)
                })
            }).catch((err) => {
                req.flash('error_msg', 'Houve uma falha ao encontrar o plano.')
                res.redirect('/cliente/usinas/' + req.params.id)
            })
        }).catch((err) => {
            req.flash('error_msg', 'Houve uma falha ao encontrar o cliente.')
            res.redirect('/cliente/usinas/' + req.params.id)
        })
    }).catch((err) => {
        req.flash('error_msg', 'Houve uma falha ao encontrar o projeto.')
        res.redirect('/cliente/usinas/' + req.params.id)
    })
})

router.get('/excluirusina/:id', (req, res) => {
    ////console.log('entrou')
    Usina.findOne({ _id: req.params.id }).then((usina_cliente) => {
        Usina.findOneAndDelete({ _id: req.params.id }).then(() => {
            ////console.log('id cliente=>' + usina_cliente.cliente)
            req.flash('success_msg', 'Usina removida com sucesso!')
            res.redirect('/cliente/usinas/' + usina_cliente.cliente)
        }).catch((err) => {
            req.flash('error_msg', 'Não foi possível excluir a usina.')
            res.redirect('/cliente/usinas/' + usina_cliente.cliente)
        })
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar a usina.')
        res.redirect('/cliente/usinas/' + usina_cliente.cliente)
    })

})

router.get('/dados/:dados', ehAdmin, (req, res) => {
    var params = req.params.dados
    params = params.split('@')
    const wb = new xl.Workbook()
    const ws = wb.addWorksheet('Relatório')
    const headingColumnNames = [
        "Cliente",
        "Endereço",
        "Proposta",
        "Data",
        "Vendedor"
    ]
    const headingLineNames = [
        params[0],
        params[1],
        params[2],
        params[3],
        params[4]
    ]
    var headingColumnIndex = 1; //diz que começará na primeira linha
    headingColumnNames.forEach(heading => { //passa por todos itens do array
        //cria uma célula do tipo string para cada título
        ws.cell(1, headingColumnIndex++).string(heading)
    })
    headingColumnIndex = 1
    headingLineNames.forEach(heading => { //passa por todos itens do array
        //cria uma célula do tipo string para cada título
        ws.cell(2, headingColumnIndex++).string(heading)
    })
    var time = new Date()
    var arquivo = 'cabecalho_propostas_' + dataHoje() + time.getTime() + '.xlsx'
    //console.log('arquivi=>'+arquivo)
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
})

router.post('/buscaCPF', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    var id

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }

    var q = 0
    var propostas = []
    //console.log('req.body.buscacpf=>' + req.body.buscacpf)
    //console.log('req.body.id=>' + req.body.id)
    Cliente.findOne({ user: id, cpf: req.body.buscacpf }).then((cliente) => {
        if (naoVazio(cliente)) {
            Projeto.find({ cliente: cliente._id }).then((projeto) => {
                projeto.forEach((e) => {
                    Pessoa.findOne({ _id: e.vendedor }).then((vendedor) => {
                        q++
                        propostas.push({ seq: e.seq, nome_ven: vendedor.nome })
                        if (q == projeto.length) {
                            res.render('cliente/buscaCPF', { id: req.body.id, ocliente: cliente.nome, propostas })
                        }
                    }).catch((err) => {
                        req.flash('error_msg', 'Não foi possível encontrar o vendedor.')
                        res.redirect('/gerenciamento/orcamento/' + req.body.id)
                    })
                })
            }).catch((err) => {
                req.flash('error_msg', 'Não foi possível encontrar o projeto.')
                res.redirect('/gerenciamento/orcamento/' + req.body.id)
            })
        } else {
            req.flash('success_msg', 'Não a proposta para este cliente.')
            res.redirect('/gerenciamento/orcamento/' + req.body.id)
        }
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar o cliente.')
        res.redirect('/gerenciamento/orcamento/' + req.body.id)
    })
})

router.post('/edicao/', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    var id

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }

    if (req.body.nome == '' || req.body.celular == '' || req.body.cidade == '') {
        Cliente.findOne({ user: id, _id: req.body.id }).lean().then((cliente) => {
            req.flash('error_msg', 'Os campos de nome, celular e cidade são obrigatórios.')
            res.redirect('/cliente/edicao/' + req.body.id)
        }).catch((err) => {
            req.flash('error_msg', 'Não foi possível encontrar o cliente.')
            res.redirect('/cliente/novo')
        })
    } else {

        var cnpj
        var cpf
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

        // var lead = false
        // if (req.body.checkLead != null) {
        //     lead = true
        // }

        Cliente.findOne({ user: id, _id: req.body.id }).then((cliente) => {
            cliente.nome = buscaPrimeira(req.body.nome)
            cliente.cnpj = cnpj
            cliente.cpf = cpf
            cliente.cep = req.body.cep
            cliente.endereco = req.body.endereco
            cliente.cidade = req.body.cidade
            cliente.numero = req.body.numero
            cliente.bairro = req.body.bairro
            cliente.complemento = req.body.complemento
            cliente.uf = req.body.uf
            cliente.inscricao = req.body.inscricao
            cliente.celular = req.body.celular
            cliente.email = req.body.email
            cliente.contato = buscaPrimeira(req.body.contato)
            cliente.save().then(() => {
                Cliente.findOne({ user: id, _id: req.body.id }).lean().then((cliente) => {
                    req.flash('success_msg', 'Alterações realizadas com sucesso.')
                    res.redirect('/cliente/edicao/' + req.body.id)
                }).catch((err) => {
                    req.flash('error_msg', 'Não foi possível encontrar o cliente.')
                    res.redirect('/cliente/novo')
                })
            }).catch((err) => {
                req.flash('error_msg', 'Não foi possível salvar as modificações.')
                res.redirect('/cliente/novo')
            })
        }).catch((err) => {
            req.flash('error_msg', 'Não foi possível encontrar o cliente.')
            res.redirect('/cliente/novo')
        })
    }
})

router.post('/geraprograma/', ehAdmin, (req, res) => {

    var id
    const { _id } = req.user
    const { user } = req.user
    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }

    var tempo = req.body.tempo
    var inter = req.body.intervalo
    var perini = req.body.periodoini
    var perfim = req.body.periodofim

    var freq
    var add
    var novadataini
    var novadatafim
    var data1
    var data2
    var mes
    var dia
    var ano

    data1 = new Date(perfim)
    data2 = new Date(perini)
    var diff = Math.abs(data1.getTime() - data2.getTime())
    ////console.log('diff=>' + diff)
    var days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    ////console.log('days=>' + days)

    ////console.log('tempo=>' + tempo)

    if (tempo == 'horas') {
        freq = Math.round((days * 24) / inter)
        add = inter / 24
    } else {
        if (tempo == 'meses') {
            freq = Math.round(days / 30 / inter)
            add = inter * 30
        } else {
            freq = Math.round(days / inter)
            add = parseFloat(inter)
        }
    }

    ////console.log('freq=>' + freq)
    ////console.log('add=>' + add)

    ////console.log('id=>' + id)
    ////console.log('req.body.usina=>' + req.body.usina)
    ////console.log('req.body.atividade=>' + req.body.atividade)
    ////console.log('req.body.tipo=>' + req.body.tipo)
    ////console.log('req.body.tempo=>' + req.body.tempo)
    ////console.log('req.body.inter=>' + inter)
    ////console.log('perini=>' + dataBusca(perini))
    ////console.log('perfim=>' + dataBusca(perfim))
    ////console.log('data>' + dataHoje())
    const programa = {
        user: id,
        usina: req.body.usina,
        atividade: req.body.atividade,
        tipo: req.body.tipo,
        tempo: tempo,
        intervalo: inter,
        periodoini: dataBusca(perini),
        periodofim: dataBusca(perfim),
        data: dataHoje()
    }
    new Programacao(programa).save().then(() => {
        ////console.log('salvou')
        Programacao.findOne({ user: id }).sort({ field: 'asc', _id: -1 }).then((prog) => {
            ////console.log('prog=>' + prog._id)
            for (i = 0; i < freq; i++) {
                if (i == 0) {
                    novadataini = perini
                    //console.log('add=>' + add)
                    novadatafim = setData(novadataini, add)
                    mes = novadatafim.substring(5, 7)
                    //console.log('mes')
                    if (parseFloat(mes) == 0) {
                        dia = novadatafim.substring(8, 10)
                        mes = '12'
                        ano = novadatafim.substring(0, 4)
                        novadatafim = ano + '-' + mes + '-' + dia
                    }

                } else {
                    novadataini = novadatafim
                    novadatafim = setData(novadatafim, add)
                    mes = novadatafim.substring(5, 7)
                    //console.log('mes=>' + mes)
                    if (parseFloat(mes) == 0) {
                        dia = novadatafim.substring(8, 10)
                        mes = '12'
                        ano = novadatafim.substring(0, 4)
                        novadatafim = ano + '-' + mes + '-' + dia
                    }
                }
                //console.log('novadataini=>' + novadataini)
                //console.log('novadatafim=>' + novadatafim)
                new Tarefa({
                    user: id,
                    usina: req.body.usina,
                    responsavel: _id,
                    programacao: prog._id,
                    servico: req.body.atividade,
                    concluido: false,
                    dataini: novadataini,
                    datafim: novadatafim,
                    buscadataini: dataBusca(novadataini),
                    buscadatafim: dataBusca(novadatafim),
                    cadastro: dataHoje()
                }).save().then(() => {
                    ////console.log('i=>' + i)
                    if (i == freq) {
                        ////console.log('entrou')
                        res.redirect('/cliente/programacao/' + req.body.usina)
                    }
                }).catch((err) => {
                    req.flash('error_msg', 'Houve um erro ao salvar a tarefa.')
                    res.redirect('/cliente/usinas/' + req.body.idcliente)
                })
            }
        }).catch((err) => {
            req.flash('error_msg', 'Houve um erro ao encontrar a programação.')
            res.redirect('/cliente/usinas/' + req.body.idcliente)
        })
    }).catch((err) => {
        req.flash('error_msg', 'Houve um erro ao salvar a programação.')
        res.redirect('/cliente/usinas/' + req.body.idcliente)
    })
})

router.post('/salvartarefa', ehAdmin, (req, res) => {
    Tarefa.findOne({ _id: req.body.id }).then((t) => {
        if (req.body.concluido == 'Sim') {
            t.concluido = true
        } else {
            t.concluido = false
        }
        t.dataini = String(req.body.dataini)
        t.buscadataini = dataBusca(req.body.dataini)
        t.servico = req.body.atividade
        t.save().then(() => {
            res.redirect('/cliente/programacao/' + req.body.usina)
        }).catch((err) => {
            req.flash('error_msg', 'Houve um erro ao salvar a tarefa.')
            res.redirect('/cliente/programacao/' + req.body.usina)
        })
    })
})

router.post('/addusina/', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    var id

    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }
    var plano = {}
    var usina = {}
    var cadastro = dataHoje()
    var datalimp = dataMensagem(setData(dataHoje(), 182))
    var buscalimp = dataBusca(setData(dataHoje(), 182))
    var datarevi = dataMensagem(setData(dataHoje(), 30))
    var buscarevi = dataBusca(setData(dataHoje(), 30))

    ////console.log('req.body.plano=>' + req.body.plano)

    const corpo = {
        user: id,
        nome: req.body.nome,
        endereco: req.body.endereco,
        cliente: req.body.id,
        classificacao: req.body.classUsina,
        tipo: req.body.tipoUsina,
        area: req.body.area,
        qtdmod: req.body.qtdmod,
        cadastro: cadastro,
        datalimp: datalimp,
        buscalimp: buscalimp,
        datarevi: datarevi,
        buscarevi: buscarevi
    }

    if (req.body.plano != '' && req.body.plano != 'Serviço Único') {
        plano = { plano: req.body.plano }
        usina = Object.assign(plano, corpo)
    } else {
        usina = corpo
    }

    new Usina(usina).save().then(() => {
        req.flash('success_msg', 'Usina adcionada com sucesso.')
        res.redirect('/cliente/usinas/' + req.body.id)
    }).catch((err) => {
        req.flash('error_msg', 'Houve um erro ao salvar a usina.')
        res.redirect('/cliente/usinas/' + req.body.idcliente)
    })
})

router.post('/editusina', (req, res) => {
    ////console.log('idusina=>' + req.body.idusina)
    ////console.log('req.body.plano=>' + req.body.plano)
    Usina.findOne({ _id: req.body.idusina }).then((usina) => {
        usina.nome = req.body.nome
        usina.endereco = req.body.endereco
        usina.cadastro = req.body.cadastro
        usina.area = req.body.area
        usina.qtdmod = req.body.qtdmod
        usina.classificacao = req.body.classUsina
        usina.tipo = req.body.tipoUsina
        if (naoVazio(req.body.plano) && req.body.plano != 'Serviço Único') {
            usina.plano = req.body.plano
        }
        usina.save().then(() => {
            req.flash('success_msg', 'Usina salva com sucesso.')
            res.redirect('/cliente/usinas/' + req.body.idcliente)
        }).catch((err) => {
            req.flash('error_msg', 'Houve um erro ao salvar a usina.')
            res.redirect('/cliente/usinas/' + req.body.idcliente)
        })
    })
})

router.get('/remover/:id', ehAdmin, async (req, res) => {
    const { user } = req.user
    const { _id } = req.user
    var id
    if (typeof user == 'undefined') {
        id = _id
    } else {
        id = user
    }
    Projeto.findOne({ cliente: req.params.id}).then(async p => {
        console.log('p.equipe=>'+p.equipe)
        if (naoVazio(p.equipe)){
            await Equipe.findOneAndDelete({ _id: p.equipe });
        }else{
            await Equipe.findOneAndDelete({ projeto: p.equipe });
        }
    })
    await Projeto.findOneAndDelete({ cliente: req.params.id });
    await Cliente.findOneAndDelete({ _id: req.params.id });

    req.flash('success_msg', 'Cliente excluido com sucesso')
    res.redirect('/cliente/consulta')
})

router.post('/filtrar', ehAdmin, (req, res) => {
    const { _id } = req.user
    const { user } = req.user
    const { vendedor } = req.user
    const { pessoa } = req.user
    var id
    var idpes
    var sql1 = {}
    var sql2 = {}
    var sql = {}
    var q = 0
    var clientes = []

    if (typeof user == 'undefined') {
        id = _id
        sql1 = { user: id }
    } else {
        console.log('entrou')
        id = user
        console.log('vendedor=>' + String(vendedor).length)
        if (String(vendedor).length == 4) {
            sql1 = { user: id, vendedor: pessoa }
        } else {
            sql1 = { user: id }
        }
    }
    var cidade = req.body.cidade
    var uf = req.body.uf
    var nome = req.body.nome

    if (nome != '' && uf != '' && cidade != '') {
        if (req.body.tipo == 'lead') {
            sql2 = { nome: { $regex: buscaPrimeira(nome) }, uf: { $regex: uf }, cidade: { $regex: cidade }, lead: true }
        } else {
            sql2 = { nome: { $regex: buscaPrimeira(nome) }, uf: { $regex: uf }, cidade: { $regex: cidade } }
        }
    } else {
        if (nome == '' && cidade == '' && uf == '') {
            console.log('entrou')
            if (req.body.tipo == 'lead') {
                sql2 = { user: id, lead: true }
            } else {
                sql2 = { user: id }
            }
        } else {
            if (nome == '' && cidade == '') {
                if (req.body.tipo == 'lead') {
                    sql2 = { uf: { $regex: uf }, lead: true }
                } else {
                    sql2 = { uf: { $regex: uf } }
                }
            } else {
                if (nome == '' && uf == '') {
                    if (req.body.tipo == 'lead') {
                        sql2 = { cidade: { $regex: cidade }, lead: true }
                    } else {
                        sql2 = { cidade: { $regex: cidade } }
                    }
                } else {
                    if (cidade == '' && uf == '') {
                        if (req.body.tipo == 'lead') {
                            sql2 = { nome: { $regex: buscaPrimeira(nome) }, lead: true }
                        } else {
                            sql2 = { nome: { $regex: buscaPrimeira(nome) } }
                        }
                    } else {
                        if (cidade == '') {
                            if (req.body.tipo == 'lead') {
                                sql2 = { nome: { $regex: buscaPrimeira(nome) }, uf: { $regex: uf }, lead: true }
                            } else {
                                sql2 = { nome: { $regex: buscaPrimeira(nome) }, uf: { $regex: uf } }
                            }
                        } else {
                            if (uf == '') {
                                if (req.body.tipo == 'lead') {
                                    sql2 = { nome: { $regex: buscaPrimeira(nome) }, cidade: { $regex: cidade }, lead: true }
                                } else {
                                    sql2 = { nome: { $regex: buscaPrimeira(nome) }, cidade: { $regex: cidade } }
                                }
                            } else {
                                if (req.body.tipo == 'lead') {
                                    sql2 = { cidade: { $regex: cidade }, uf: { $regex: uf }, lead: true }
                                } else {
                                    sql2 = { cidade: { $regex: cidade }, uf: { $regex: uf } }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Object.assign(sql, sql1, sql2)
    Cliente.find(sql).then((cliente) => {
        if (naoVazio(cliente)) {
            cliente.forEach((e) => {
                Pessoa.findOne({ _id: e.vendedor }).then((vendedor) => {
                    clientes.push({ _id: e._id, nome: buscaPrimeira(e.nome), cidade: e.cidade, uf: e.uf, contato: e.contato, celular: e.celular, vendedor: vendedor.nome })
                    q++
                    if (q == cliente.length) {
                        res.render('cliente/consulta', { clientes })
                    }
                }).catch((err) => {
                    req.flash('error_msg', 'Não foi possível encontrar os vendedores.')
                    res.redirect('/dashboard')
                })
            })
        } else {
            req.flash('error_msg', 'Sem registro para esta busca')
            res.redirect('/cliente/consulta')
        }
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar os clientes.')
        res.redirect('/cliente/novo')
    })
})


module.exports = router