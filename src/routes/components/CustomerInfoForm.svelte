<!--
  Customer Information Form for PDF Generation
  This component can be integrated to collect customer details for the PDF report
-->

<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let customerName: string = '';
  export let customerEmail: string = '';
  export let customerPhone: string = '';
  export let isVisible: boolean = false;

  const dispatch = createEventDispatcher();

  function handleSubmit() {
    dispatch('submit', {
      customerName,
      customerEmail,
      customerPhone
    });
    isVisible = false;
  }

  function handleCancel() {
    isVisible = false;
    dispatch('cancel');
  }
</script>

{#if isVisible}
  <div class="customer-form-overlay">
    <div class="customer-form">
      <h3>Informazioni Cliente</h3>
      <p class="form-description">
        Inserisci le tue informazioni per personalizzare il report PDF
      </p>

      <div class="form-group">
        <label for="customerName">Nome e Cognome</label>
        <input
          id="customerName"
          type="text"
          bind:value={customerName}
          placeholder="Es. Mario Rossi"
          required
        />
      </div>

      <div class="form-group">
        <label for="customerEmail">Email</label>
        <input
          id="customerEmail"
          type="email"
          bind:value={customerEmail}
          placeholder="Es. mario.rossi@email.it"
          required
        />
      </div>

      <div class="form-group">
        <label for="customerPhone">Telefono</label>
        <input
          id="customerPhone"
          type="tel"
          bind:value={customerPhone}
          placeholder="Es. 333 123 4567"
          required
        />
      </div>

      <div class="form-actions">
        <button type="button" class="btn-cancel" on:click={handleCancel}>
          Annulla
        </button>
        <button type="button" class="btn-submit" on:click={handleSubmit}>
          Genera PDF
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .customer-form-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .customer-form {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  }

  h3 {
    margin: 0 0 0.5rem 0;
    color: rgb(45, 77, 49);
    font-size: 1.5rem;
    font-weight: 600;
  }

  .form-description {
    margin: 0 0 1.5rem 0;
    color: #666;
    font-size: 0.9rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #333;
  }

  input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
    transition: border-color 0.2s ease;
  }

  input:focus {
    outline: none;
    border-color: rgb(45, 77, 49);
    box-shadow: 0 0 0 2px rgba(45, 77, 49, 0.1);
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .btn-cancel, .btn-submit {
    flex: 1;
    padding: 0.75rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-cancel {
    background: #f5f5f5;
    color: #666;
  }

  .btn-cancel:hover {
    background: #e8e8e8;
  }

  .btn-submit {
    background: rgb(45, 77, 49);
    color: white;
  }

  .btn-submit:hover {
    background: rgb(35, 57, 39);
    transform: translateY(-1px);
  }

  @media (max-width: 768px) {
    .customer-form {
      margin: 1rem;
      padding: 1.5rem;
    }
  }
</style>
