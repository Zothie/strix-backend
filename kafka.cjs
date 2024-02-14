const express = require('express');
const { Kafka } = require('kafkajs');
const bodyParser = require('body-parser');



const app = express();
const port = 3010;

app.use(bodyParser.json());


// Конфигурация Kafka
const kafka = new Kafka({
  clientId: 'my-app123',
  brokers: ['192.168.230.131:9092'], // Замените на адрес вашего Kafka-брокера
});

// Создание Producer
const producer = kafka.producer();

// Обработчик для отправки сообщений в Kafka
app.post('/api/sdk/kafkatest', async (req, res) => {
  const {topic, data} = req.body;
  try {
    await producer.connect();
    await producer.send({
      topic: topic,
      messages: [
        { value: JSON.stringify(data) },
      ],
    });

    console.log(`Message sent to topic ${topic}: ${data}`);
    res.send('Message sent successfully');
  } catch (error) {
    console.error(`Error sending message to topic ${topic}: ${error.message}`);
    res.status(500).send(`Error sending message: ${error.message}`);
  } finally {
    await producer.disconnect();
  }
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});