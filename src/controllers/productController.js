const ProductModel = require('../models/productModel')
const aws = require("../aws/awsConfig")
const { isValid, isValidPrice, isValidTitle, isValidFile, isValidInstallments } = require('../utils/validator');
const productModel = require('../models/productModel');
let {isValidObjectId} = require('mongoose')

const createProduct = async (req, res) => {
    try {
        let data = req.body;
        let { title, description, price, currencyId, currencyFormat, isFreeShipping, productImage, style, availableSizes, installments, deletedAt, isDeleted } = data
        if (Object.keys(data).length == 0) {
            return res.status(400).send({ status: false, message: " body can not be empty" })
        }

        if (!title || !isValid(title)) {
            return res.status(400).send({ status: false, message: "title is mandatory" })
        }
        if (!isValidTitle(title)) {
            return res.status(400).send({ status: false, message: "invalid title" })
        }
        let uniqueTitle = await ProductModel.findOne({ title: title })
        if (uniqueTitle) {
            return res.status(400).send({ status: false, message: "this title already exists" })
        }
        if (!description || !isValid(description)) {
            return res.status(400).send({ status: false, message: "description is mandatory" })
        }
        if (!price || !isValid(price)) {
            return res.status(400).send({ status: false, message: "price is mandatory" })
        }
        if (!isValidPrice(price)) {
            return res.status(400).send({ status: false, message: "invalid price" })
        }
        if (!currencyId)
            return res.status(400).send({ status: false, message: "Currency Id is required" })

        if (currencyId != "INR")
            return res.status(400).send({ status: false, msg: "Currency will be in INR" })

        if (!currencyFormat) {
            return res.status(400).send({ status: false, message: "CurrencyFormat is required" })
        }
        if (currencyFormat != "₹")
            return res.status(400).send({ status: false, msg: "CurrencyFormat will be in ₹" })

        if (isFreeShipping) {
            if (!(isFreeShipping == "true" || isFreeShipping == "false")) {
                return res.status(400).send({ status: false, msg: "isfreeshiping either true or false" })
            }
        }


        ////////////////////////////AWS FILE UPLOADING/////////////////////////////////////////////////////
        let files = req.files
        if (files && files.length > 0) {
            if (!isValidFile(files[0].originalname)) {
                return res.status(400).send({ status: false, message: " formats that are accepted jpeg/jpg/png only." })
            }

            let uploadedFileURL = await aws.uploadFile(files[0]);
            data.productImage = uploadedFileURL     //assigining the file URL in request body
        } else {
            return res.status(400).send({ status: false, message: "product image is required" })
        }

        if (!isValid(style)) {
            return res.status(400).send({ status: false, message: "style can not be empty" })
        }
        if (availableSizes) {
            if (availableSizes != "S" && availableSizes != "XS" && availableSizes != "M" && availableSizes != "X" && availableSizes != "L" && availableSizes != "XXL" && availableSizes != "XL") {
                return res.status(400).send({ status: false, message: "Available sizes are XS,S,M,L,X,XXL,XL, please enter available size" })
            }
        }

        if (!isValid(installments) || !isValidInstallments(installments)) {
            return res.status(400).send({ status: false, message: "installments must be in numbers" })
        }


        //////////////////////////////CREATING PRODUCT////////////////////////////////////////////////////////
        let productCreate = await productModel.create(data)
        return res.status(201).send({ status: true, message: "success", data: productCreate })
    }
    catch (error) {
        return res.status(500).send({ status: false, message: error.message })
    }
}




const getProduct = async function (req, res) {
    try {
        let { size, name, priceGreaterThan, priceLessThan, priceSort } = req.query;

        const filter = { isDeleted: false };
        if (size) {
            filter["availableSizes"] = size
        }

        if (name) {
            if (!isValidName(name)) return res.status(400).send({ stastus: false, message: "Invalid naming format!" });

            filter["title"] = name
        }

        if (priceGreaterThan) {
            filter["price"] = { $gt: priceGreaterThan }
        }

        if (priceLessThan) {
            filter["price"] = { $lt: priceLessThan }
        }

        if (priceGreaterThan && priceLessThan) {

            if (priceGreaterThan == priceLessThan) return res.status(400).send({ status: false, message: "priceGreaterThan and priceLessThan can't be equal" });

            filter["price"] = { $gt: priceGreaterThan, $lt: priceLessThan }
        }

        if (priceSort) {
            if (priceSort == 1) {
                let find = await productModel.find(filter).sort({ price: 1 });
                if (!find) {
                    return res.status(400).send({
                        status: false,
                        message: "No data found that matches your search",
                    });
                }
                return res.status(200).send({ status: true, message: "Success", data: find });
            }
            if (priceSort == -1) {
                let find2 = await productModel.find(filter).sort({ price: -1 });
                if (!find2) {
                    return res.status(404).send({
                        status: false,
                        message: "No data found that matches your search1",
                    });
                }
                return res.status(200).send({ status: true, message: "Success", data: find2 });
            }
        }

        const finaldata = await productModel.find(filter);

        if (!finaldata || finaldata.length == 0) {
            return res.status(404).send({
                status: false,
                message: "No data found that matches your search 2"
            })
        }


        return res.status(200).send({ status: true, message: "Success", data: finaldata });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};


//fetch products by Id.
const getProductsById = async function(req, res) {
    try {
        const productId = req.params.productId

        //validation starts.
        if (!isValidObjectId(productId)) {
            return res.status(400).send({ status: false, message: `${productId} is not a valid product id` })
        }
        //validation ends.

        const product = await productModel.findOne({ _id: productId, isDeleted: false });

        if (!product) {
            return res.status(404).send({ status: false, message: `product does not exists` })
        }

        return res.status(200).send({ status: true, message: 'Product found successfully', data: product })
    } catch (err) {
        return res.status(500).send({
            status: false,
            message: err.message
        })
    }
}


const updateProduct = async function(req,res){
try{

        const productId = req.params.productId;

        if(!productId) return res.status(400).send({status:false,message:"Please pass product id in params!!"})

        if(!isValidObjectId(productId)) return res.status(400).send({status:false,message:"Product id is invalid!!"})

    } catch(error){
        return res.status(500).send({status:false,message:error.message})
    }
}
module.exports = { createProduct , getProductsById }