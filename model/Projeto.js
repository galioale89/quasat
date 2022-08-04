const mongoose = require('mongoose')
const Schema = mongoose.Schema

const Projeto = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'usuario',
        require: false,
    },
    seq: {
        type: String,
        require: false
    },
    cliente: {
        type: Schema.Types.ObjectId,
        ref: 'cliente',
        require: false,
    },
    equipe: {
        type: Schema.Types.ObjectId,
        ref: 'equipe',
        require: false,
    },    
    ins_banco: {
        type: Schema.Types.ObjectId,
        ref: 'pessoa',
        require: false,
    },
    ins_real: {
        type: Boolean,
        require: false
    },    
    responsavel: {
        type: Schema.Types.ObjectId,
        ref: 'pessoa',
        require: false,
    }, 
    vendedor: {
        type: Schema.Types.ObjectId,
        ref: 'pessoa',
        require: false,
    },
    novo: {
        type: Boolean,
        require: false
    },
    ampliacao: {
        type: Boolean,
        require: false
    },
    checkpedido: {
        type: Boolean,
        require: false
    },
    pedido: {
        type: Schema.Types.ObjectId,
        ref: 'pedido',
        require: false,
    },
    empresa: {
        type: Schema.Types.ObjectId,
        ref: 'empresa',
        require: false,
    },
    tarefa: [{
        idtarefa: {
            type: Schema.Types.ObjectId,
            ref: 'tarefa',
            require: false,
        }
    }],
    params: [{
        descricao: {
            type: String,
            require: false,
        },
        tipo: {
            type: String,
            require: false,
        },
        valor: {
            type: String,
            require: false,
        }
    }],
    material: [{
        desc: {
            type: String,
            require: false,
        },
        qtd: {
            type: String,
            require: false,
        }
    }],
    endereco: {
        type: String,
        require: false
    },
    numero: {
        type: String,
        require: false
    },
    bairro: {
        type: String,
        require: false
    },
    cep: {
        type: String,
        require: false
    },
    complemento: {
        type: String,
        require: false
    },
    uf: {
        type: String,
        require: false
    },
    cidade: {
        type: String,
        require: false
    },
    fatura: [{
        desc: {
            type: String,
            require: false
        },
        data: {
            type: String,
            require: false
        }
    }],
    descuc: {
        type: String,
        require: false
    },
    descug: {
        type: String,
        require: false
    },
    pagamento: {
        type: String,
        require: false
    },
    pagador: {
        type: String,
        require: false
    },
    prazo: {
        type: String,
        require: false
    },
    obsgeral: {
        type: String,
        require: false
    },
    obsprojetista: {
        type: String,
        require: false
    },     
    uc: [{
        seq: {
            type: Number,
            require: false,
        },
        jan: {
            type: Number,
            require: false,
        },
        fev: {
            type: Number,
            require: false,
        },
        mar: {
            type: Number,
            require: false,
        },
        abr: {
            type: Number,
            require: false,
        },
        mai: {
            type: Number,
            require: false,
        },
        jun: {
            type: Number,
            require: false,
        },
        jul: {
            type: Number,
            require: false,
        },
        ago: {
            type: Number,
            require: false,
        },
        set: {
            type: Number,
            require: false,
        },
        out: {
            type: Number,
            require: false,
        },
        nov: {
            type: Number,
            require: false,
        },
        dez: {
            type: Number,
            require: false,
        },
        total: {
            type: Number,
            require: false,
        }
    }],
    adduc: {
        type: Number,
        require: false
    },
    documento: [{
        desc: {
            type: String,
            require: false
        },
        data: {
            type: String,
            require: false
        }
    }],
    entrada: [{
        desc: {
            type: String,
            require: false
        },
        data: {
            type: String,
            require: false
        }
    }],
    disjuntor: [{
        desc: {
            type: String,
            require: false
        },
        data: {
            type: String,
            require: false
        }
    }],
    trafo: [{
        desc: {
            type: String,
            require: false
        },
        data: {
            type: String,
            require: false
        }
    }],
    localizacao: [{
        desc: {
            type: String,
            require: false
        },
        data: {
            type: String,
            require: false
        }
    }],
    local: [{
        desc: {
            type: String,
            require: false
        },
        data: {
            type: String,
            require: false
        }
    }],    
    telhado_foto: [{
        desc: {
            type: String,
            require: false
        },
        data: {
            type: String,
            require: false
        }
    }],    
    medidor: [{
        desc: {
            type: String,
            require: false
        },
        data: {
            type: String,
            require: false
        }
    }],
    proposta: [{
        seq: {
            type: Number,
            require: false
        },
        arquivo: {
            type: String,
            require: false
        },
        data: {
            type: String,
            require: false
        },
        validade: {
            type: String,
            require: false
        },
        obs: {
            type: String,
            require: false
        },
    }],
    obs: {
        type: String,
        require: false
    },
    excel: {
        type: String,
        require: false
    },
    liberar: {
        type: Boolean,
        require: false
    },
    autorizado: {
        type: Boolean,
        require: false
    },
    pago: {
        type: Boolean,
        require: false
    },    
    ganho: {
        type: Boolean,
        require: false
    },
    execucao: {
        type: Boolean,
        require: false
    },
    parado: {
        type: Boolean,
        require: false
    },
    instalado: {
        type: Boolean,
        require: false
    },
    encerrado: {
        type: Boolean,
        require: false
    },
    baixada: {
        type: Boolean,
        require: false
    },
    aceite: {
        type: Boolean,
        require: false
    },
    entregue: {
        type: Boolean,
        require: false
    },
    dtentrega: {
        type: String,
        require: false
    },
    futuro: {
        type: Boolean,
        require: false
    },
    dtfuturo: {
        type: String,
        require: false
    },
    concessionaria: {
        type: String,
        require: false
    },
    telhado: {
        type: String,
        require: false
    },
    estrutura: {
        type: String,
        require: false
    },
    orientacao: {
        type: String,
        require: false
    },
    sobredim: {
        type: String,
        require: false
    },
    plaQtdMod: {
        type: Number,
        require: false
    },
    plaWattMod: {
        type: String,
        require: false
    },
    plaQtdInv: {
        type: Number,
        require: false
    },
    plaKwpInv: {
        type: String,
        require: false
    },
    plaDimArea: {
        type: String,
        require: false
    },
    plaQtdString: {
        type: String,
        require: false
    },
    potencia: {
        type: Number,
        require: false
    },
    vlrKit: {
        type: Number,
        require: false
    },
    vlrServico: {
        type: Number,
        require: false
    },
    valor: {
        type: Number,
        require: false
    },
    dataSoli: {
        type: String,
        require: false
    },
    dataApro: {
        type: String,
        require: false
    },
    dataTroca: {
        type: String,
        require: false
    },
    dataPost: {
        type: String,
        require: false
    },
    dtbaixa: {
        type: String,
        require: false
    },
    motivo: {
        type: String,
        require: false
    },
    descmot: {
        type: String,
        require: false
    },
    status: {
        type: String,
        require: false
    },
    descstatus: {
        type: String,
        require: false
    },
    datastatus: {
        type: String,
        require: false
    },
    datacad: {
        type: Number,
        require: false
    },
    ref: {
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
    termo: [{
        desc: {
            type: String,
            require: false
        },
        data: {
            type: String,
            require: false
        }
    }],
    data: {
        type: Date,
        default: Date.now(),
        require: false
    }
})

mongoose.model('projeto', Projeto)