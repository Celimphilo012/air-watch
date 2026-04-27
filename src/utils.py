"""
utils.py
--------
Shared helper functions used across the AirWatch Eswatini system.
Import these in other scripts as needed:
  from src.utils import who_category, season_label, format_report_row
"""

import pandas as pd
import numpy as np
from datetime import date


# ── AQI / WHO helpers ─────────────────────────────────────────────────────────

def who_category(pm25: float) -> str:
    """Return WHO PM2.5 category label."""
    if pd.isna(pm25):  return "Unknown"
    if pm25 <= 10:     return "Good"
    elif pm25 <= 25:   return "Moderate"
    elif pm25 <= 50:   return "Unhealthy"
    return "Hazardous"


def who_category_color(pm25: float) -> str:
    """Return hex color for a PM2.5 value."""
    cat = who_category(pm25)
    return {
        "Good":      "#2e7d32",
        "Moderate":  "#f9a825",
        "Unhealthy": "#e65100",
        "Hazardous": "#b71c1c",
        "Unknown":   "#9e9e9e",
    }.get(cat, "#9e9e9e")


def aqi_from_pm25(pm25: float) -> int:
    """
    Simplified AQI calculation from PM2.5 (µg/m³).
    Based on US EPA linear interpolation between breakpoints.
    """
    breakpoints = [
        (0.0,  12.0,  0,  50),
        (12.1, 35.4,  51, 100),
        (35.5, 55.4,  101, 150),
        (55.5, 150.4, 151, 200),
        (150.5, 250.4, 201, 300),
        (250.5, 500.4, 301, 500),
    ]
    for c_lo, c_hi, i_lo, i_hi in breakpoints:
        if c_lo <= pm25 <= c_hi:
            return round(((i_hi - i_lo) / (c_hi - c_lo)) * (pm25 - c_lo) + i_lo)
    return 500


# ── seasonal helpers ──────────────────────────────────────────────────────────

def season_label(month: int) -> str:
    """Return 'Dry' or 'Wet' season label for an Eswatini month."""
    return "Dry" if month in [5, 6, 7, 8, 9] else "Wet"


def is_dry_season(month: int) -> int:
    """Return 1 if dry season, 0 if wet."""
    return 1 if month in [5, 6, 7, 8, 9] else 0


# ── data summary helpers ──────────────────────────────────────────────────────

def zone_summary(df: pd.DataFrame) -> pd.DataFrame:
    """
    Return a summary DataFrame with mean, max, and WHO exceedance % per zone.
    Expects columns: location, pm25
    """
    summary = df.groupby("location").agg(
        pm25_mean  = ("pm25", "mean"),
        pm25_max   = ("pm25", "max"),
        pm25_min   = ("pm25", "min"),
        record_count = ("pm25", "count"),
    ).round(2)
    summary["pct_above_who"] = (
        df[df["pm25"] > 10].groupby("location")["pm25"].count() /
        df.groupby("location")["pm25"].count() * 100
    ).round(1)
    summary["aqi_category"] = summary["pm25_mean"].apply(who_category)
    return summary.reset_index()


def monthly_avg(df: pd.DataFrame, zone: str = None) -> pd.DataFrame:
    """Return monthly average PM2.5, optionally filtered by zone."""
    fdf = df[df["location"] == zone] if zone else df
    return fdf.groupby("month")["pm25"].mean().round(2).reset_index()


# ── report helpers ────────────────────────────────────────────────────────────

def format_report_row(forecast: dict) -> str:
    """Format a single forecast dict as a readable report line."""
    return (
        f"{forecast['Date']}  {forecast['Day']:<10}  "
        f"PM2.5: {forecast['PM2.5']:>6.2f} µg/m³  "
        f"[{who_category(forecast['PM2.5'])}]"
    )


def exceeds_who(pm25: float, threshold: float = 10.0) -> bool:
    """Return True if PM2.5 exceeds the WHO guideline."""
    return pm25 > threshold


# ── feature engineering helpers ───────────────────────────────────────────────

def add_time_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add month, year, day_of_week, and season columns from a date column."""
    df = df.copy()
    df["month"]       = pd.to_datetime(df["date"]).dt.month
    df["year"]        = pd.to_datetime(df["date"]).dt.year
    df["day_of_week"] = pd.to_datetime(df["date"]).dt.dayofweek
    df["season"]      = df["month"].apply(season_label)
    df["is_dry_season"] = df["month"].apply(is_dry_season)
    return df


if __name__ == "__main__":
    # quick self-test
    print("utils.py — self-test")
    print(f"  who_category(8.0)  = {who_category(8.0)}")
    print(f"  who_category(18.0) = {who_category(18.0)}")
    print(f"  who_category(35.0) = {who_category(35.0)}")
    print(f"  who_category(60.0) = {who_category(60.0)}")
    print(f"  aqi_from_pm25(18)  = {aqi_from_pm25(18)}")
    print(f"  season_label(7)    = {season_label(7)}")
    print(f"  season_label(11)   = {season_label(11)}")
    print("  All OK.")