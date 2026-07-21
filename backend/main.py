import os
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from dotenv import load_dotenv

import models
from database import engine, get_db

from google import genai
from google.genai import types

import pathlib

env_path = pathlib.Path(__file__).parent.parent / '.env.local'
load_dotenv(dotenv_path=env_path)

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

frontend_path = pathlib.Path(__file__).parent.parent / 'frontend'
app.mount("/static", StaticFiles(directory=str(frontend_path)), name="static")

@app.get("/")
def read_index():
    return FileResponse(str(frontend_path / "index.html"))

@app.get("/style.css")
def read_css():
    return FileResponse(str(frontend_path / "style.css"))

@app.get("/script.js")
def read_js():
    return FileResponse(str(frontend_path / "script.js"))

class SalesRecordInput(BaseModel):
    month: str
    unitsSold: float
    costPricePerUnit: float
    sellingPricePerUnit: float

class PredictRequest(BaseModel):
    records: List[SalesRecordInput]

class PredictResponse(BaseModel):
    predictedUnits: float
    totalRevenue: float
    totalCost: float
    profitOrLoss: float
    isLoss: bool
    aiAnalysis: Optional[str] = None
    historicalLabels: List[str]
    historicalData: List[float]
    predictedLabel: str

def predict_next_month_sales(data: List[SalesRecordInput]) -> float:
    if len(data) < 2:
        return data[0].unitsSold if data else 0

    n = len(data)
    sum_x = 0
    sum_y = 0
    sum_xy = 0
    sum_x2 = 0

    for i in range(n):
        x = i
        y = data[i].unitsSold
        sum_x += x
        sum_y += y
        sum_xy += x * y
        sum_x2 += x * x

    denominator = n * sum_x2 - sum_x * sum_x
    if denominator == 0:
        return data[-1].unitsSold

    slope = (n * sum_xy - sum_x * sum_y) / denominator
    intercept = (sum_y - slope * sum_x) / n

    prediction = slope * n + intercept
    return max(0, round(prediction))

def generate_ai_analysis(data: List[SalesRecordInput], total_revenue: float, total_cost: float, profit_or_loss: float) -> str:
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return "AI analysis is unavailable because no API key is configured. Add GEMINI_API_KEY or GOOGLE_API_KEY in .env to enable detailed insights."

    try:
        client = genai.Client(api_key=api_key)
        
        sales_data_str = "\n".join([
            f"- Month: {r.month}, Units Sold: {r.unitsSold}, Cost Price: {r.costPricePerUnit}, Selling Price: {r.sellingPricePerUnit}"
            for r in data
        ])

        is_loss = profit_or_loss < 0
        status_text = "loss" if is_loss else "profit"
        
        prompt = f"""You are an expert financial analyst providing insights into business performance.
Analyze the provided sales data and financial metrics to provide a strategic analysis of the predicted {status_text}.

Sales Data:
{sales_data_str}

Financial Summary:
Total Revenue: {total_revenue}
Total Cost: {total_cost}
Profit or Loss: {profit_or_loss} (This indicates a {status_text}.)

Based on the provided information, the business is projected to make a {status_text}.
Please provide a detailed analysis explaining the possible reasons for this {status_text}. Focus on identifying factors such as:
1.  **Selling Price**: Evaluate if the selling price per unit is optimal compared to the cost price per unit.
2.  **Cost Price**: Assess if the cost price per unit is well-managed or excessively high.
3.  **Sales Trend**: Examine the 'Units Sold' across different months to identify any noticeable trends (growth or decline).
4.  **Overall Profit Margin**: Comment on the overall profit margin implied by the revenue and cost figures.

Provide actionable insights or strategic recommendations for future growth. The analysis should be comprehensive, easy to understand for a business owner, and structured clearly."""

        response = client.models.generate_content(
            model='gemini-1.5-flash',
            contents=prompt,
        )
        return response.text
    except Exception as e:
        print(f"Error calling GenAI: {e}")
        return f"Unable to generate AI analysis at this time. Error: {str(e)}"

@app.post("/api/predict", response_model=PredictResponse)
def predict_sales(req: PredictRequest, db: Session = Depends(get_db)):
    if not req.records:
        raise HTTPException(status_code=400, detail="No records provided")
    
    predicted_units = predict_next_month_sales(req.records)

    avg_cost = sum(r.costPricePerUnit for r in req.records) / len(req.records)
    avg_selling = sum(r.sellingPricePerUnit for r in req.records) / len(req.records)

    total_revenue = predicted_units * avg_selling
    total_cost = predicted_units * avg_cost
    profit_or_loss = total_revenue - total_cost
    is_loss = profit_or_loss < 0

    analysis = generate_ai_analysis(req.records, total_revenue, total_cost, profit_or_loss)

    # Prepare Chart Data
    historical_labels = [r.month for r in req.records]
    historical_data = [r.unitsSold for r in req.records]
    predicted_label = "Next Month" 

    # Save to database
    db_pred = models.Prediction(
        predicted_units=predicted_units,
        total_revenue=total_revenue,
        total_cost=total_cost,
        profit_or_loss=profit_or_loss,
        is_loss=is_loss,
        loss_analysis=analysis
    )
    db.add(db_pred)
    db.commit()
    db.refresh(db_pred)

    for r in req.records:
        db_record = models.SalesRecord(
            prediction_id=db_pred.id,
            month=r.month,
            units_sold=r.unitsSold,
            cost_price_per_unit=r.costPricePerUnit,
            selling_price_per_unit=r.sellingPricePerUnit
        )
        db.add(db_record)
    
    db.commit()

    return PredictResponse(
        predictedUnits=predicted_units,
        totalRevenue=total_revenue,
        totalCost=total_cost,
        profitOrLoss=profit_or_loss,
        isLoss=is_loss,
        aiAnalysis=analysis,
        historicalLabels=historical_labels,
        historicalData=historical_data,
        predictedLabel=predicted_label
    )
