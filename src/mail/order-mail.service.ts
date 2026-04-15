import { Injectable } from '@nestjs/common';
import { MailService } from '../mail/mail.service';

@Injectable()
export class OrderMailService {
  constructor(private readonly mailService: MailService) {}

  async sendOrderConfirmation(order: any, customer: any) {
    const itemsHtml = order.items.map((item: any) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">R$ ${item.price}</td>
      </tr>
    `).join('');

    await this.mailService.sendMail({
      to: customer.email,
      subject: `Pedido ${order.orderNumber} confirmado!`,
      html: `
        <h1>Obrigado pelo seu pedido!</h1>
        <p>Seu pedido <strong>${order.orderNumber}</strong> foi confirmado.</p>
        
        <h2>Resumo do Pedido</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 10px; text-align: left;">Produto</th>
              <th style="padding: 10px; text-align: left;">Qtd</th>
              <th style="padding: 10px; text-align: left;">Preço</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <p><strong>Total: R$ ${order.total}</strong></p>
        
        <p>Você pode acompanhar seu pedido em: <a href="${process.env.STORE_URL}/pedido/${order.orderNumber}">Acompanhar Pedido</a></p>
      `,
    });
  }

  async sendOrderShipped(order: any, customer: any, trackingInfo?: any) {
    let trackingHtml = '';
    if (trackingInfo) {
      trackingHtml = `
        <h2>Informações de Rastreamento</h2>
        <p><strong>Transportadora:</strong> ${trackingInfo.carrier}</p>
        <p><strong>Código de rastreamento:</strong> ${trackingInfo.trackingNumber}</p>
      `;
    }

    await this.mailService.sendMail({
      to: customer.email,
      subject: `Seu pedido ${order.orderNumber} foi enviado!`,
      html: `
        <h1>Seu pedido foi enviado!</h1>
        <p>Seu pedido <strong>${order.orderNumber}</strong> foi enviado.</p>
        ${trackingHtml}
        <p><a href="${process.env.STORE_URL}/pedido/${order.orderNumber}">Acompanhar envio</a></p>
      `,
    });
  }

  async sendOrderDelivered(order: any, customer: any) {
    await this.mailService.sendMail({
      to: customer.email,
      subject: `Pedido ${order.orderNumber} entregue!`,
      html: `
        <h1>Seu pedido foi entregue!</h1>
        <p>Seu pedido <strong>${order.orderNumber}</strong> foi entregue.</p>
        <p>Esperamos que você goste da sua compra!</p>
        <p><a href="${process.env.STORE_URL}/produtos">Continue comprando</a></p>
      `,
    });
  }

  async sendOrderCancelled(order: any, customer: any, reason?: string) {
    await this.mailService.sendMail({
      to: customer.email,
      subject: `Pedido ${order.orderNumber} cancelado`,
      html: `
        <h1>Pedido Cancelado</h1>
        <p>Seu pedido <strong>${order.orderNumber}</strong> foi cancelado.</p>
        ${reason ? `<p><strong>Motivo:</strong> ${reason}</p>` : ''}
        <p>Se você tiver alguma dúvida, entre em contato conosco.</p>
      `,
    });
  }
}
