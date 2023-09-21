import {Component, OnInit, ViewEncapsulation} from '@angular/core';
import {NgIf} from '@angular/common';
import {FormControl, FormGroup, Validators, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {ConfirmationService, MessageService} from 'primeng/api';
import {CardModule} from 'primeng/card';
import {ConfirmDialogModule} from 'primeng/confirmdialog';
import {ToastModule} from 'primeng/toast';
import {ButtonModule} from 'primeng/button';
import {DropdownModule} from 'primeng/dropdown';
import {AutoCompleteModule} from 'primeng/autocomplete';
import {ProgressSpinnerModule} from 'primeng/progressspinner';
import * as MapboxDirections from '@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions';
import * as mapboxgl from 'mapbox-gl';
import {AppConfig} from '@configs';
import {AuthService} from '@core/auth';
import {CreateLoad, UpdateLoad, EnumType, LoadStatus, LoadStatuses, Truck} from '@core/models';
import {ApiService} from '@core/services';
import {DistanceUtils} from '@shared/utils';
import {AddressSearchboxComponent, SelectedAddressEvent} from '@shared/components';


@Component({
  selector: 'app-edit-load',
  templateUrl: './edit-load.component.html',
  styleUrls: ['./edit-load.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    ToastModule,
    ConfirmDialogModule,
    CardModule,
    NgIf,
    ProgressSpinnerModule,
    FormsModule,
    ReactiveFormsModule,
    AutoCompleteModule,
    DropdownModule,
    ButtonModule,
    RouterLink,
    AddressSearchboxComponent,
  ],
  providers: [
    ConfirmationService,
  ],
})
export class EditLoadComponent implements OnInit {
  public accessToken = AppConfig.mapboxToken;
  private map!: mapboxgl.Map;
  private directions!: any;
  private distanceMeters: number;

  public id?: string;
  public headerText: string;
  public isBusy: boolean;
  public editMode: boolean;
  public form: FormGroup;
  public suggestedDrivers: SuggestedDriver[];
  public loadStatuses: EnumType[];
  public originAddress: string = '';
  public destinationAddress: string = '';

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private route: ActivatedRoute)
  {
    this.isBusy = false;
    this.editMode = true;
    this.headerText = 'Edit a load';
    this.suggestedDrivers = [];
    this.loadStatuses = LoadStatuses;
    this.distanceMeters = 0;

    this.form = new FormGroup({
      name: new FormControl(''),
      orgAddress: new FormControl('', Validators.required),
      orgCoords: new FormControl('', Validators.required),
      dstAddress: new FormControl('', Validators.required),
      dstCoords: new FormControl('', Validators.required),
      dispatchedDate: new FormControl(new Date().toLocaleDateString(), Validators.required),
      deliveryCost: new FormControl(0, Validators.required),
      distance: new FormControl(0, Validators.required),
      dispatcherName: new FormControl('', Validators.required),
      dispatcherId: new FormControl('', Validators.required),
      assignedTruck: new FormControl('', Validators.required),
      status: new FormControl(LoadStatus.Dispatched, Validators.required),
    });
  }

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.id = params['id'];
    });

    this.initMapbox();
    this.fetchCurrentDispatcher();

    if (!this.id) {
      this.editMode = false;
      this.headerText = 'Add a new load';
    }
    else {
      this.fetchLoad(this.id);
      this.headerText = 'Edit a load';
    }
  }

  searchTruck(event: any) {
    this.apiService.getTruckDrivers(event.query).subscribe((result) => {
      if (!result.success || !result.items) {
        return;
      }

      this.suggestedDrivers = result.items.map((truckDriver) => (
        {
          truckId: truckDriver.truck.id,
          driversName: this.formatDriversName(truckDriver.truck),
        }),
      );
    });
  }

  submit() {
    const assignedTruck = this.form.value.assignedTruck;

    if (!assignedTruck) {
      this.messageService.add({key: 'notification', severity: 'error', summary: 'Error', detail: 'Select a truck'});
      return;
    }

    if (this.editMode) {
      this.updateLoad();
    }
    else {
      this.createLoad();
    }
  }

  confirmToDelete() {
    this.confirmationService.confirm({
      message: 'Are you sure that you want to delete this load?',
      accept: () => this.deleteLoad(),
    });
  }

  updateOriginAddress(eventData: SelectedAddressEvent) {
    this.directions.setOrigin(eventData.center);
    this.form.patchValue({
      orgAddress: eventData.address,
      orgCoords: eventData.center,
    });
  }

  updateDestinationAddress(eventData: SelectedAddressEvent) {
    this.directions.setDestination(eventData.center);
    this.form.patchValue({
      dstAddress: eventData.address,
      dstCoords: eventData.center,
    });
  }

  private createLoad() {
    this.isBusy = true;

    const command: CreateLoad = {
      name: this.form.value.name,
      originAddress: this.form.value.orgAddress,
      originAddressLong: this.form.value.orgCoords[0],
      originAddressLat: this.form.value.orgCoords[1],
      destinationAddress: this.form.value.dstAddress,
      destinationAddressLong: this.form.value.dstCoords[0],
      destinationAddressLat: this.form.value.dstCoords[1],
      deliveryCost: this.form.value.deliveryCost,
      distance: this.distanceMeters,
      assignedDispatcherId: this.form.value.dispatcherId,
      assignedTruckId: this.form.value.assignedTruck.truckId,
    };

    this.apiService.createLoad(command)
        .subscribe((result) => {
          if (result.success) {
            this.messageService.add({key: 'notification', severity: 'success', summary: 'Notification', detail: 'A new load has been created successfully'});
            this.resetForm();
          }

          this.isBusy = false;
        });
  }

  private updateLoad() {
    const command: UpdateLoad = {
      id: this.id!,
      name: this.form.value.name,
      originAddress: this.form.value.orgAddress,
      originAddressLong: this.form.value.orgCoords[0],
      originAddressLat: this.form.value.orgCoords[1],
      destinationAddress: this.form.value.dstAddress,
      destinationAddressLong: this.form.value.dstCoords[0],
      destinationAddressLat: this.form.value.dstCoords[1],
      deliveryCost: this.form.value.deliveryCost,
      distance: this.distanceMeters,
      assignedDispatcherId: this.form.value.dispatcherId,
      assignedTruckId: this.form.value.assignedTruck.truckId,
      status: this.form.value.status,
    };

    this.apiService.updateLoad(command)
        .subscribe((result) => {
          if (result.success) {
            this.messageService.add({key: 'notification', severity: 'success', summary: 'Notification', detail: 'Load has been updated successfully'});
          }

          this.isBusy = false;
        });
  }

  private deleteLoad() {
    if (!this.id) {
      return;
    }

    this.isBusy = true;
    this.apiService.deleteLoad(this.id).subscribe((result) => {
      if (result.success) {
        this.messageService.add({key: 'notification', severity: 'success', summary: 'Notification', detail: 'A load has been deleted successfully'});
        this.resetForm();

        this.isBusy = false;
      }
    });
  }

  private initMapbox() {
    this.map = new mapboxgl.Map({
      container: 'routeMap',
      accessToken: this.accessToken,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [-74.5, 40],
      zoom: 6,
    });

    this.directions = new MapboxDirections({
      accessToken: this.accessToken,
      profile: 'mapbox/driving-traffic',
      congestion: true,
      interactive: false,
      controls: {
        profileSwitcher: false,
        instructions: false,
        inputs: false,
      },
    });

    this.directions.on('route', (data: any) => {
      this.distanceMeters = data.route[0].distance;
      const distanceMiles = DistanceUtils.metersTo(this.distanceMeters, 'mi');
      this.form.patchValue({distance: distanceMiles});
    });

    this.map.addControl(this.directions, 'top-left');
  }

  private fetchCurrentDispatcher() {
    const userData = this.authService.getUserData();
    this.form.patchValue({
      dispatcherName: userData?.name,
      dispatcherId: userData?.id,
    });
  }

  private fetchLoad(id: string) {
    this.apiService.getLoad(id).subscribe((result) => {
      if (result.success && result.value) {
        const load = result.value;

        this.form.patchValue({
          name: load.name,
          orgAddress: load.originAddress,
          dstAddress: load.destinationAddress,
          dispatchedDate: this.getLocaleDate(load.dispatchedDate),
          deliveryCost: load.deliveryCost,
          distance: DistanceUtils.metersTo(load.distance, 'mi'),
          dispatcherName: load.assignedDispatcherName,
          dispatcherId: load.assignedDispatcherId,
          status: load.status,
          assignedTruck: {
            truckId: load.assignedTruck.id,
            driversName: this.formatDriversName(load.assignedTruck)},
        });

        this.directions.setOrigin(load.originAddress!);
        this.directions.setDestination(load.destinationAddress!);
        this.originAddress = load.originAddress;
        this.destinationAddress = load.destinationAddress;
      }
    });
  }

  private resetForm() {
    this.form.reset();

    this.form.patchValue({
      dispatchedDate: new Date().toLocaleDateString(),
      deliveryCost: 0,
      distance: 0,
    });

    this.originAddress = '';
    this.destinationAddress = '';
    this.directions.removeRoutes();
    this.editMode = false;
    this.headerText = 'Add a new load';
    this.id = undefined;
    this.fetchCurrentDispatcher();
  }

  private formatDriversName(truck: Truck): string {
    const driversName = truck.drivers.map((driver) => driver.fullName);
    return `${truck.truckNumber} - ${driversName}`;
  }

  private getLocaleDate(dateStr?: string | Date): string {
    if (dateStr) {
      return new Date(dateStr).toLocaleDateString();
    }
    return '';
  }
}

interface SuggestedDriver {
  driversName: string,
  truckId: string;
}
