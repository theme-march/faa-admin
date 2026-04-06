const { sequelize, ContactModel} = require("../../models");
const { QueryTypes } = require('sequelize');

exports.Insert  = async (req, res, next) => {
  const errorHandler = (err) => {
    return res.status(200).json({
      success: false,
      error: err
    });
  };

  const InsertDetails = await ContactModel.create(req.body).catch(errorHandler);
  if(InsertDetails.id){
    return res.status(200).json({
      success: true,
      result: InsertDetails,
    });
  }else{
    return res.status(200).json({
      success: false,
      message: "Data not inserted",
    });
  }
};
