const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')

require('../model/Parametros')
const Parametros = mongoose.model('parametros')
const naoVazio = require('../resources/naoVazio')
const { ehAdmin } = require('../helpers/ehAdmin')

router.get('/novo/', ehAdmin, (req, res) => {

    const { _id } = req.user
    const { user } = req.user
    var id

    if (naoVazio(user)) {
        id = user
    } else {
        id = _id
    }

    Parametros.find({ user: id }).lean().then((params) => {
        console.log(params)
        if (naoVazio(params)) {
            res.render('principal/paramsSolar', { params })
        } else {
            res.render('principal/paramsSolar')
        }
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar os parâmetros.')
        res.redirect('/dashboard')
    })

})

router.get('/edicao/:id', ehAdmin, (req, res) => {
    Parametros.findOne({ _id: req.params.id }).lean().then((parametros) => {
        res.render('parametros/cadastro', { parametros })
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar o parâmetro.')
        res.redirect('/dashboard')
    })
})

router.get('/consulta/', ehAdmin, (req, res) => {
    Parametros.find().lean().then((parametros) => {
        res.render('parametros/findcomponente', { parametros })
    }).catch((err) => {
        req.flash('error_msg', 'Não foi possível encontrar o parâmetro.')
        res.redirect('/dashboard')
    })
})

router.post('/salvar', ehAdmin, (req, res) => {
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
        erro = erro + 'É necessário incluir a descrição do parâmetro. '
    }
    if (erro != '') {
        req.flash('error_msg', erro)
        res.redirect('/dashboard')
    } else {
            const comp = {
                user: id,
                descricao: req.body.descricao,
                valor: req.body.valor,
                tipo: 'solar',
                opcao: req.body.opcao,
            }
            
            new Parametros(comp).save().then(() => {
                req.flash('success_msg', 'Parâmetro adicionado com sucesso.')
                res.redirect('/parametros/novo/')
            }).catch((err) => {
                req.flash('error_msg', 'Não foi possível salvar o parâmetro.')
                res.redirect('/dashboard')
            })
        //}
    }
})

router.get('/deletar/:id', ehAdmin, (req, res) => {
    Parametros.findOneAndDelete({ _id: req.params.id }).then(() => {
        req.flash('success_msg', 'Parâmetro removido.')
        res.redirect('/parametros/novo/')
    }).catch((err) => {
        req.flash('error_msg', 'Falha ao encontrar o parâmetro.')
        res.redirect('/parametros/novo/')
    })
})

module.exports = router