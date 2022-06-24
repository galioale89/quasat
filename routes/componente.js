const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')

require('../model/Componente')
const Componente = mongoose.model('componente')

const { ehAdmin } = require('../helpers/ehAdmin')

router.get('/novo', ehAdmin, (req, res) => {
    res.render('componente/cadastro')
})

router.get('/novo/:id', ehAdmin, (req, res) => {
    Componente.findOne({ _id: req.params.id }).lean().then((componente) => {
        res.render('componente/cadastro', { componente })
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar o componente.')
        res.redirect('/componente/novo')
    })
})

router.get('/consulta/', ehAdmin, (req, res) => {
    Componente.find().lean().then((componente) => {
        res.render('componente/findcomponente', { componente })
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar o componente.')
        res.redirect('/componente/novo')
    })
})

router.post('/salvar', ehAdmin, (req, res) => {
    var erro = ''
    var classificacao

    if (req.body.nome == '') {
        erro = erro + 'É necessário incluir a descrição do item. '
    }
    if (req.body.classificacao == '') {
        erro = erro + 'É necessário incluir o preço do item. '
    }
    if (req.body.tipo == '') {
        erro = erro + 'É necessário incluir o tipo do item. '
    }
    if (req.body.classificacao == '') {
        erro = erro + 'É necessário incluir o classificação do item. '
    }
    if (erro != '') {
        req.flash('error_msg', erro)
        res.redirect('/componente/novo')
    } else {
        // console.log('req.body.id=>'+req.body.id)
        if (req.body.id != '') {
            // console.log('entrou')
            if (req.body.classificacao == 'Solar'){
                classificacao = 'solar'
            }else{
                if (req.body.classificacao == 'Ar'){
                    classificacao = 'ar'
                }else{
                    classificacao = 'camara'
                }
            }
            Componente.findOne({ _id: req.body.id }).then((componente) => {
                componente.nome = req.body.nome
                componente.fornecedor = req.body.fornecedor
                componente.classificacao = classificacao
                componente.tipo = req.body.tipo
                componente.preco = req.body.preco
                componente.observacao = req.body.observacao
                componente.save().then(() => {
                    req.flash('success_msg','Equipamento salvo com sucesso.')
                    res.redirect('/componente/novo/' + req.body.id )
                }).catch((err) => {
                    req.flash('error_msg', 'Não foi possível salvar o componente.')
                    res.redirect('/componente/novo')
                })
            }).catch((err) => {
                req.flash('error_msg', 'Não foi possível encontrar o componente.')
                res.redirect('/componente/novo')
            })
        } else {
            if (req.body.classificacao == 'Solar'){
                classificacao = 'solar'
            }else{
                if (req.body.classificacao == 'Ar'){
                    classificacao = 'ar'
                }else{
                    classificacao = 'camara'
                }
            }
            const comp = {
                nome: req.body.nome,
                fornecedor: req.body.fornecedor,
                classificacao: classificacao,
                tipo: req.body.tipo,
                preco: req.body.preco,
                observacao: req.body.observacao,
            }
            new Componente(comp).save().then(() => {
                Componente.findOne().sort({ field: 'asc', _id: -1 }).then((componente) => {
                    req.flash('success_msg','Equipamento adicionado com sucesso.')
                    res.redirect('/componente/novo/' + componente._id)
                }).catch((err) => {
                    req.flash('error_msg', 'Não foi possível encontrar o componente.')
                    res.redirect('/componente/novo')
                })
            }).catch((err) => {
                req.flash('error_msg', 'Não foi possível salvar o componente.')
                res.redirect('/componente/novo')
            })
        }
    }
})

module.exports = router