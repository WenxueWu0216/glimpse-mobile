FROM python:3.12-slim
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
ENV GLIMPSE_DB=/data/glimpse.db GLIMPSE_UPLOADS=/data/uploads
VOLUME /data
EXPOSE 8000
# Seed demo notes only when the database is empty, then serve.
CMD ["sh", "-c", "python -m app.seed --count 600 --if-empty && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
