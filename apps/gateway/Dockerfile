FROM python:3.12-slim

WORKDIR /app

RUN groupadd -r urumi && useradd -r -g urumi urumi

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . /app/apps/gateway/

ENV PYTHONPATH=/app
ENV GATEWAY_HOST=0.0.0.0
ENV GATEWAY_PORT=8000

RUN chown -R urumi:urumi /app
USER urumi

EXPOSE 8000
CMD ["python", "-m", "uvicorn", "apps.gateway.main:app", "--host", "0.0.0.0", "--port", "8000"]
