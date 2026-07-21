from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    predicted_units = Column(Float, nullable=False)
    total_revenue = Column(Float, nullable=False)
    total_cost = Column(Float, nullable=False)
    profit_or_loss = Column(Float, nullable=False)
    is_loss = Column(Boolean, nullable=False)
    loss_analysis = Column(String, nullable=True)

    # A prediction can be based on multiple sales records
    records = relationship("SalesRecord", back_populates="prediction")

class SalesRecord(Base):
    __tablename__ = "sales_records"

    id = Column(Integer, primary_key=True, index=True)
    prediction_id = Column(Integer, ForeignKey("predictions.id"))
    month = Column(String, index=True)
    units_sold = Column(Float)
    cost_price_per_unit = Column(Float)
    selling_price_per_unit = Column(Float)

    prediction = relationship("Prediction", back_populates="records")
