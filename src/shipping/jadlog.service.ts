import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface JadlogRateRequest {
  cepOrigem: string;
  cepDestino: string;
  vlMercadoria: number;
  psReal: number; // peso real em kg
}

interface JadlogRate {
  modalidade: string;
  valor: number;
  prazoEntrega: number;
}

@Injectable()
export class JadlogService {
  private readonly baseUrl = 'https://www.jadlog.com.br/embarcador/api';

  constructor(private readonly configService: ConfigService) {}

  async calculateShipping(
    request: JadlogRateRequest,
  ): Promise<Array<{ code: string; name: string; price: number; days: number }>> {
    const token = this.configService.get('JADLOG_TOKEN', '');

    if (!token) {
      // Return mock data for development
      return [
        { code: '3', name: '.Package', price: 32.50, days: 6 },
        { code: '4', name: 'Rodoviario', price: 28.00, days: 7 },
      ];
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/frete/valor`,
        {
          cepOrigem: request.cepOrigem.replace(/\D/g, ''),
          cepDestino: request.cepDestino.replace(/\D/g, ''),
          vlMercadoria: request.vlMercadoria,
          psReal: request.psReal,
          modalidades: ['3', '4', '5', '6', '7'],
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const frete = response.data?.frete || [];
      
      return frete.map((rate: JadlogRate) => ({
        code: rate.modalidade,
        name: this.getModalityName(rate.modalidade),
        price: rate.valor,
        days: rate.prazoEntrega,
      }));
    } catch (error) {
      console.error('Jadlog API error:', error);
      // Return mock data for development
      return [
        { code: '3', name: '.Package', price: 32.50, days: 6 },
        { code: '4', name: 'Rodoviario', price: 28.00, days: 7 },
      ];
    }
  }

  private getModalityName(code: string): string {
    const names: Record<string, string> = {
      '0': 'Expresso',
      '3': '.Package',
      '4': 'Rodoviario',
      '5': 'Economico',
      '6': 'Doc',
      '7': 'Corporate',
    };
    return names[code] || `Modalidade ${code}`;
  }
}
