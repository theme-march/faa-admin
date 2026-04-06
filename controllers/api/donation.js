const {DonationModel} = require("../../models");


exports.Save  = async (req, res, next) => {
  const errorHandler = (err) => {
    return res.status(200).json({
      success: false,
      error: err
    });
  };


    try {
      const eventRegisterInsert = await DonationModel.create(req.body).catch(errorHandler);
      return res.status(200).json({
        success: true,
        result: eventRegisterInsert,
      });
    } catch (error) {
      return res.status(200).json({
        success: false,
        error: error
      });
    }


};
